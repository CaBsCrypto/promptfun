use anchor_lang::prelude::*;
use crate::MarketError;
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;
pub const CURVE_SUPPLY: u64 = 800_000_000_000_000;
pub const LOCKED_SUPPLY: u64 = 200_000_000_000_000;
pub const VIRTUAL_TOKENS: u128 = 1_073_000_000_000_000;
pub const VIRTUAL_LAMPORTS: u128 = 30_000_000_000;

pub fn cumulative_cost(sold: u64) -> Result<u64> {
    require!(sold <= CURVE_SUPPLY, MarketError::CurveCap);
    let d = VIRTUAL_TOKENS.checked_sub(sold as u128).ok_or(MarketError::Arithmetic)?;
    let numerator = VIRTUAL_LAMPORTS.checked_mul(VIRTUAL_TOKENS).ok_or(MarketError::Arithmetic)?;
    let rounded = numerator.checked_add(d - 1).ok_or(MarketError::Arithmetic)? / d;
    u64::try_from(rounded.checked_sub(VIRTUAL_LAMPORTS).ok_or(MarketError::Arithmetic)?)
        .map_err(|_| error!(MarketError::Arithmetic))
}
pub fn buy_cost(sold: u64, quantity: u64) -> Result<u64> {
    require!(quantity > 0, MarketError::InvalidAmount);
    let next = sold.checked_add(quantity).ok_or(MarketError::Arithmetic)?;
    let amount = cumulative_cost(next)?.checked_sub(cumulative_cost(sold)?).ok_or(MarketError::Arithmetic)?;
    require!(amount > 0, MarketError::Dust);
    Ok(amount)
}
pub fn sell_return(sold: u64, quantity: u64) -> Result<u64> {
    require!(quantity > 0 && quantity <= sold, MarketError::InvalidAmount);
    let amount = cumulative_cost(sold)?.checked_sub(cumulative_cost(sold - quantity)?).ok_or(MarketError::Arithmetic)?;
    require!(amount > 0, MarketError::Dust);
    Ok(amount)
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    #[test] fn cap_and_boundaries() {
        assert_eq!(cumulative_cost(0).unwrap(), 0);
        assert_eq!(cumulative_cost(CURVE_SUPPLY).unwrap(), 87_912_087_913);
        assert!(buy_cost(CURVE_SUPPLY, 1).is_err());
        assert!(buy_cost(0, 0).is_err());
        assert!(sell_return(0, 1).is_err());
        assert!(buy_cost(0, u64::MAX).is_err());
        assert_eq!(sell_return(CURVE_SUPPLY, CURVE_SUPPLY).unwrap(), 87_912_087_913);
    }
    proptest! {
        #[test] fn round_trip_preserves_reserve(sold in 0u64..CURVE_SUPPLY, quantity in 1u64..CURVE_SUPPLY) {
            let quantity = quantity.min(CURVE_SUPPLY - sold);
            if let Ok(paid) = buy_cost(sold, quantity) {
                prop_assert_eq!(paid, sell_return(sold + quantity, quantity).unwrap());
                prop_assert_eq!(cumulative_cost(sold).unwrap() + paid, cumulative_cost(sold + quantity).unwrap());
            }
        }
        #[test] fn cost_is_monotonic(a in 0u64..=CURVE_SUPPLY, b in 0u64..=CURVE_SUPPLY) {
            prop_assert!(cumulative_cost(a.min(b)).unwrap() <= cumulative_cost(a.max(b)).unwrap());
        }
    }
}
