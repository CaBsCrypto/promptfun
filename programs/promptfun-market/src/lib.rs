use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, SetAuthority, Transfer};
use anchor_spl::token::spl_token::instruction::AuthorityType;
pub mod math;
use math::*;

// This public address is synchronized to the operator's external deployment key before deployment.
declare_id!("C2AEAUWXez38SBM7Hz7SmfZ8dd9WdefEvkXsKUPFNyvG");

#[program]
pub mod promptfun_market {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, registrar: Pubkey) -> Result<()> {
        require!(registrar != Pubkey::default(), MarketError::InvalidRegistrar);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.registrar = registrar;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }
    pub fn configure(ctx: Context<Configure>, registrar: Pubkey, paused: bool) -> Result<()> {
        require!(registrar != Pubkey::default(), MarketError::InvalidRegistrar);
        ctx.accounts.config.registrar = registrar;
        ctx.accounts.config.paused = paused;
        Ok(())
    }
    pub fn register_project(ctx: Context<RegisterProject>, project: [u8; 16]) -> Result<()> {
        require!(!ctx.accounts.config.paused, MarketError::Paused);
        let market = &mut ctx.accounts.market;
        market.owner = ctx.accounts.creator.key();
        market.project = project;
        market.mint = ctx.accounts.mint.key();
        market.curve_vault = ctx.accounts.curve_vault.key();
        market.locked_vault = ctx.accounts.locked_vault.key();
        market.sold = 0;
        market.reserve = 0;
        market.bump = ctx.bumps.market;
        let owner = market.owner;
        let seeds: &[&[u8]] = &[b"market", owner.as_ref(), project.as_ref(), &[market.bump]];
        let signer = &[seeds];
        token::mint_to(CpiContext::new(ctx.accounts.token_program.key(), MintTo {
            mint: ctx.accounts.mint.to_account_info(), to: ctx.accounts.curve_vault.to_account_info(),
            authority: market.to_account_info(),
        }).with_signer(signer), CURVE_SUPPLY)?;
        token::mint_to(CpiContext::new(ctx.accounts.token_program.key(), MintTo {
            mint: ctx.accounts.mint.to_account_info(), to: ctx.accounts.locked_vault.to_account_info(),
            authority: market.to_account_info(),
        }).with_signer(signer), LOCKED_SUPPLY)?;
        token::set_authority(CpiContext::new(ctx.accounts.token_program.key(), SetAuthority {
            account_or_mint: ctx.accounts.mint.to_account_info(), current_authority: market.to_account_info(),
        }).with_signer(signer), AuthorityType::MintTokens, None)?;
        emit!(MarketRegistered { project, market: market.key(), mint: market.mint, owner });
        Ok(())
    }
    pub fn buy(ctx: Context<Trade>, quantity: u64, max_lamports: u64, expiry: i64) -> Result<()> {
        validate_trade(&ctx.accounts.config, expiry)?;
        let market = &ctx.accounts.market;
        require!(market.reserve == cumulative_cost(market.sold)?, MarketError::ReserveInvariant);
        let paid = buy_cost(market.sold, quantity)?;
        require!(paid <= max_lamports, MarketError::Slippage);
        system_program::transfer(CpiContext::new(ctx.accounts.system_program.key(), system_program::Transfer {
            from: ctx.accounts.trader.to_account_info(), to: market.to_account_info(),
        }), paid)?;
        let owner = market.owner;
        let project = market.project;
        let seeds: &[&[u8]] = &[b"market", owner.as_ref(), project.as_ref(), &[market.bump]];
        token::transfer(CpiContext::new(ctx.accounts.token_program.key(), Transfer {
            from: ctx.accounts.curve_vault.to_account_info(), to: ctx.accounts.trader_tokens.to_account_info(),
            authority: market.to_account_info(),
        }).with_signer(&[seeds]), quantity)?;
        let market = &mut ctx.accounts.market;
        market.sold = market.sold.checked_add(quantity).ok_or(MarketError::Arithmetic)?;
        market.reserve = market.reserve.checked_add(paid).ok_or(MarketError::Arithmetic)?;
        assert_backing(market)?;
        emit!(TradeExecuted { market: market.key(), trader: ctx.accounts.trader.key(), buy: true, quantity, lamports: paid, sold: market.sold });
        Ok(())
    }
    pub fn sell(ctx: Context<Trade>, quantity: u64, min_lamports: u64, expiry: i64) -> Result<()> {
        validate_trade(&ctx.accounts.config, expiry)?;
        let market = &ctx.accounts.market;
        require!(market.reserve == cumulative_cost(market.sold)?, MarketError::ReserveInvariant);
        assert_backing(market)?;
        let returned = sell_return(market.sold, quantity)?;
        require!(returned >= min_lamports, MarketError::Slippage);
        token::transfer(CpiContext::new(ctx.accounts.token_program.key(), Transfer {
            from: ctx.accounts.trader_tokens.to_account_info(), to: ctx.accounts.curve_vault.to_account_info(),
            authority: ctx.accounts.trader.to_account_info(),
        }), quantity)?;
        let market_info = market.to_account_info();
        let trader_info = ctx.accounts.trader.to_account_info();
        let market_lamports = market_info.lamports().checked_sub(returned).ok_or(MarketError::Arithmetic)?;
        let trader_lamports = trader_info.lamports().checked_add(returned).ok_or(MarketError::Arithmetic)?;
        **market_info.try_borrow_mut_lamports()? = market_lamports;
        **trader_info.try_borrow_mut_lamports()? = trader_lamports;
        let market = &mut ctx.accounts.market;
        market.sold -= quantity;
        market.reserve = market.reserve.checked_sub(returned).ok_or(MarketError::Arithmetic)?;
        assert_backing(market)?;
        emit!(TradeExecuted { market: market.key(), trader: ctx.accounts.trader.key(), buy: false, quantity, lamports: returned, sold: market.sold });
        Ok(())
    }
}
fn validate_trade(config: &MarketConfig, expiry: i64) -> Result<()> {
    require!(!config.paused, MarketError::Paused);
    let now = Clock::get()?.unix_timestamp;
    require!(expiry > now && expiry <= now.checked_add(120).ok_or(MarketError::Arithmetic)?, MarketError::Expired);
    Ok(())
}
fn assert_backing(market: &Account<Market>) -> Result<()> {
    let rent = Rent::get()?.minimum_balance(market.to_account_info().data_len());
    let minimum = rent.checked_add(market.reserve).ok_or(MarketError::Arithmetic)?;
    require!(market.to_account_info().lamports() >= minimum, MarketError::RentBacking);
    require!(market.reserve == cumulative_cost(market.sold)?, MarketError::ReserveInvariant);
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ MarketError::Unauthorized)]
    pub program: Program<'info, crate::program::PromptfunMarket>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ MarketError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = authority, space = 8 + MarketConfig::SIZE, seeds = [b"config"], bump)]
    pub config: Account<'info, MarketConfig>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Configure<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = authority)]
    pub config: Account<'info, MarketConfig>,
}
#[derive(Accounts)]
#[instruction(project: [u8; 16])]
pub struct RegisterProject<'info> {
    #[account(mut)] pub creator: Signer<'info>,
    #[account(address = config.registrar)] pub registrar: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)] pub config: Account<'info, MarketConfig>,
    #[account(init, payer = creator, space = 8 + Market::SIZE,
        seeds = [b"market", creator.key().as_ref(), project.as_ref()], bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = creator, seeds = [b"mint", market.key().as_ref()], bump,
        mint::decimals = 6, mint::authority = market)]
    pub mint: Account<'info, Mint>,
    #[account(init, payer = creator, seeds = [b"curve", market.key().as_ref()], bump,
        token::mint = mint, token::authority = market)]
    pub curve_vault: Account<'info, TokenAccount>,
    #[account(init, payer = creator, seeds = [b"locked", market.key().as_ref()], bump,
        token::mint = mint, token::authority = market)]
    pub locked_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)] pub trader: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)] pub config: Account<'info, MarketConfig>,
    #[account(mut, seeds = [b"market", market.owner.as_ref(), market.project.as_ref()], bump = market.bump,
        has_one = mint, has_one = curve_vault)]
    pub market: Account<'info, Market>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"curve", market.key().as_ref()], bump, token::mint = mint, token::authority = market)]
    pub curve_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = trader)] pub trader_tokens: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
#[account]
pub struct MarketConfig { pub authority: Pubkey, pub registrar: Pubkey, pub paused: bool, pub bump: u8 }
impl MarketConfig { pub const SIZE: usize = 32 + 32 + 1 + 1; }
#[account]
pub struct Market {
    pub owner: Pubkey, pub project: [u8; 16], pub mint: Pubkey, pub curve_vault: Pubkey,
    pub locked_vault: Pubkey, pub sold: u64, pub reserve: u64, pub bump: u8,
}
impl Market { pub const SIZE: usize = 32 + 16 + 32 + 32 + 32 + 8 + 8 + 1; }
#[event] pub struct MarketRegistered { pub project: [u8; 16], pub market: Pubkey, pub mint: Pubkey, pub owner: Pubkey }
#[event] pub struct TradeExecuted { pub market: Pubkey, pub trader: Pubkey, pub buy: bool, pub quantity: u64, pub lamports: u64, pub sold: u64 }
#[error_code]
pub enum MarketError {
    #[msg("Arithmetic overflow")] Arithmetic,
    #[msg("Curve supply exhausted")] CurveCap,
    #[msg("Quantity must be positive and within sold supply")] InvalidAmount,
    #[msg("Trade value is below one lamport")] Dust,
    #[msg("Price exceeds the authorized limit")] Slippage,
    #[msg("Quote expired or validity window exceeded")] Expired,
    #[msg("Market is paused")] Paused,
    #[msg("Invalid registrar")] InvalidRegistrar,
    #[msg("Only the program upgrade authority may initialize")] Unauthorized,
    #[msg("SOL reserve invariant failed")] ReserveInvariant,
    #[msg("SOL reserve must preserve rent")] RentBacking,
}
