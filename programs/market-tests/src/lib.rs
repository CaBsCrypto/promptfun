//! Standalone LiteSVM 0.13.1 harness. Requires the real Anchor-built SBF artifact.
#[cfg(test)]
mod tests {
    use litesvm::LiteSVM;
    use solana_account::Account;
    use solana_address::Address;
    use solana_clock::Clock;
    use solana_instruction::{Instruction, AccountMeta};
    use solana_keypair::Keypair;
    use solana_message::Message;
    use solana_signer::Signer;
    use solana_transaction::Transaction;
    use solana_loader_v3_interface::state::UpgradeableLoaderState;
    use sha2::{Digest, Sha256};
    use std::{path::PathBuf, str::FromStr};

    const CAP:u64=800_000_000_000_000;
    const LOCKED:u64=200_000_000_000_000;
    fn key(s:&str)->Address {Address::from_str(s).unwrap()}
    fn disc(s:&str)->Vec<u8> {Sha256::digest(format!("global:{s}").as_bytes())[..8].to_vec()}
    fn ro(pubkey:Address)->AccountMeta {AccountMeta::new_readonly(pubkey,false)}
    fn rw(pubkey:Address)->AccountMeta {AccountMeta::new(pubkey,false)}
    fn cost(s:u64)->u64 {let d=1_073_000_000_000_000u128-s as u128;((30_000_000_000u128*1_073_000_000_000_000u128+d-1)/d-30_000_000_000u128) as u64}
    struct Harness {svm:LiteSVM,program:Address,authority:Keypair,registrar:Keypair,creator:Keypair,buyer:Keypair,
        config:Address,market:Address,mint:Address,curve:Address,locked:Address,trader_tokens:Address,project:[u8;16]}
    impl Harness {
        fn new()->Self {
            let authority=Keypair::new();let registrar=Keypair::new();let creator=Keypair::new();let buyer=Keypair::new();
            let source=std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../promptfun-market/src/lib.rs")).unwrap();
            let id=source.split("declare_id!(\"").nth(1).unwrap().split('"').next().unwrap();let program=key(id);
            let path=std::env::var("PROGRAM_SO").map(PathBuf::from).unwrap_or_else(|_|PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/promptfun_market.so"));
            assert!(path.exists(),"Build real SBF first in Linux CI: bash scripts/solana-build-ci.sh (missing {})",path.display());
            let mut svm=LiteSVM::new();svm.add_program_from_file(program,path).unwrap();
            for pair in [&authority,&registrar,&creator,&buyer] {svm.airdrop(&pair.pubkey(),200_000_000_000).unwrap();}
            let loader=key("BPFLoaderUpgradeab1e11111111111111111111111");
            let (programdata,_)=Address::find_program_address(&[program.as_ref()],&loader);
            let mut data=svm.get_account(&programdata).unwrap();
            bincode::serialize_into(&mut data.data[..45],&UpgradeableLoaderState::ProgramData{slot:0,upgrade_authority_address:Some(authority.pubkey())}).unwrap();
            svm.set_account(programdata,data).unwrap();
            let mut clock=svm.get_sysvar::<Clock>();clock.unix_timestamp=1_000;svm.set_sysvar(&clock);
            let project=[42u8;16];
            let (config,_)=Address::find_program_address(&[b"config"],&program);
            let (market,_)=Address::find_program_address(&[b"market",creator.pubkey().as_ref(),&project],&program);
            let pda=|seed:&[u8]|Address::find_program_address(&[seed,market.as_ref()],&program).0;
            let mint=pda(b"mint");let curve=pda(b"curve");let locked=pda(b"locked");let trader_tokens=Address::new_unique();
            Self{svm,program,authority,registrar,creator,buyer,config,market,mint,curve,locked,trader_tokens,project}
        }
        fn send(&mut self,ix:Instruction,signers:&[&Keypair])->Result<(),String> {
            self.svm.expire_blockhash();
            let tx=Transaction::new(signers,Message::new(&[ix],Some(&signers[0].pubkey())),self.svm.latest_blockhash());
            self.svm.send_transaction(tx).map(|_|()).map_err(|e|format!("{e:?}"))
        }
        fn init_ix(&self,authority:Address)->Instruction {
            let loader=key("BPFLoaderUpgradeab1e11111111111111111111111");
            let programdata=Address::find_program_address(&[self.program.as_ref()],&loader).0;
            let mut data=disc("initialize");data.extend(self.registrar.pubkey().as_ref());
            Instruction{program_id:self.program,data,accounts:vec![AccountMeta::new(authority,true),ro(self.program),ro(programdata),rw(self.config),ro(Address::default())]}
        }
        fn register_ix(&self,registrar:Address)->Instruction {
            let mut data=disc("register_project");data.extend(self.project);
            Instruction{program_id:self.program,data,accounts:vec![AccountMeta::new(self.creator.pubkey(),true),AccountMeta::new_readonly(registrar,true),ro(self.config),rw(self.market),rw(self.mint),rw(self.curve),rw(self.locked),ro(key("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),ro(Address::default()),ro(key("SysvarRent111111111111111111111111111111111"))]}
        }
        fn trade_ix(&self,buy:bool,q:u64,limit:u64,expiry:i64)->Instruction {
            let mut data=disc(if buy{"buy"}else{"sell"});data.extend(q.to_le_bytes());data.extend(limit.to_le_bytes());data.extend(expiry.to_le_bytes());
            Instruction{program_id:self.program,data,accounts:vec![AccountMeta::new(self.buyer.pubkey(),true),ro(self.config),rw(self.market),ro(self.mint),rw(self.curve),rw(self.trader_tokens),ro(key("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),ro(Address::default())]}
        }
        fn token_amount(&self,account:Address)->u64 {let a=self.svm.get_account(&account).unwrap();u64::from_le_bytes(a.data[64..72].try_into().unwrap())}
        fn market_state(&self)->(u64,u64) {let a=self.svm.get_account(&self.market).unwrap();(u64::from_le_bytes(a.data[152..160].try_into().unwrap()),u64::from_le_bytes(a.data[160..168].try_into().unwrap()))}
        fn setup(&mut self) {
            let authority=self.authority.insecure_clone();let registrar=self.registrar.insecure_clone();let creator=self.creator.insecure_clone();
            self.send(self.init_ix(authority.pubkey()),&[&authority]).unwrap();
            self.send(self.register_ix(registrar.pubkey()),&[&creator,&registrar]).unwrap();
            let mut data=vec![0u8;165];data[..32].copy_from_slice(self.mint.as_ref());data[32..64].copy_from_slice(self.buyer.pubkey().as_ref());data[108]=1;
            self.svm.set_account(self.trader_tokens,Account{lamports:self.svm.minimum_balance_for_rent_exemption(165),data,owner:key("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),executable:false,rent_epoch:0}).unwrap();
        }
    }
    #[test]
    fn upgrade_authority_and_dual_signature_registration_are_enforced() {
        let mut h=Harness::new();let attacker=Keypair::new();h.svm.airdrop(&attacker.pubkey(),1_000_000_000).unwrap();
        assert!(h.send(h.init_ix(attacker.pubkey()),&[&attacker]).is_err());assert!(h.svm.get_account(&h.config).is_none());
        let authority=h.authority.insecure_clone();h.send(h.init_ix(authority.pubkey()),&[&authority]).unwrap();
        let creator=h.creator.insecure_clone();
        assert!(h.send(h.register_ix(attacker.pubkey()),&[&creator,&attacker]).is_err());assert!(h.svm.get_account(&h.market).is_none());
        let registrar=h.registrar.insecure_clone();h.send(h.register_ix(registrar.pubkey()),&[&creator,&registrar]).unwrap();
        assert!(h.send(h.register_ix(registrar.pubkey()),&[&creator,&registrar]).is_err());
        let mint=h.svm.get_account(&h.mint).unwrap();assert_eq!(&mint.data[0..4],&[0u8;4]);assert_eq!(&mint.data[46..50],&[0u8;4]);assert_eq!(mint.data[44],6);
        assert_eq!(u64::from_le_bytes(mint.data[36..44].try_into().unwrap()),CAP+LOCKED);
        assert_eq!(h.token_amount(h.curve),CAP);assert_eq!(h.token_amount(h.locked),LOCKED);
    }
    #[test]
    fn buy_sell_cap_reopening_slippage_expiry_and_locked_vault_are_atomic() {
        let mut h=Harness::new();h.setup();let buyer=h.buyer.insecure_clone();
        let rent=h.svm.get_balance(&h.market).unwrap();let original=h.market_state();
        let mut deposit=2u32.to_le_bytes().to_vec();deposit.extend(1000u64.to_le_bytes());
        h.send(Instruction{program_id:Address::default(),accounts:vec![AccountMeta::new(buyer.pubkey(),true),rw(h.market)],data:deposit},&[&buyer]).unwrap();
        assert_eq!(h.market_state(),original); // unsolicited SOL is not curve credit
        assert!(h.send(h.trade_ix(true,CAP,cost(CAP)-1,1090),&[&buyer]).is_err());assert_eq!(h.market_state(),original);
        assert!(h.send(h.trade_ix(true,CAP,cost(CAP),999),&[&buyer]).is_err());assert_eq!(h.market_state(),original);
        h.send(h.trade_ix(true,CAP,cost(CAP),1090),&[&buyer]).unwrap();assert_eq!(h.market_state(),(CAP,cost(CAP)));assert_eq!(h.token_amount(h.curve),0);
        assert_eq!(h.svm.get_balance(&h.market).unwrap(),rent+1000+cost(CAP));assert_eq!(h.token_amount(h.locked),LOCKED);
        assert!(h.send(h.trade_ix(true,1,u64::MAX,1090),&[&buyer]).is_err());
        let q=100_000_000_000_000;let refund=cost(CAP)-cost(CAP-q);
        let mut wrong=h.trade_ix(false,q,refund,1090);wrong.accounts[4]=rw(h.locked);
        assert!(h.send(wrong,&[&buyer]).is_err());assert_eq!(h.token_amount(h.locked),LOCKED);
        let mut wrong_owner=h.trade_ix(false,q,refund,1090);wrong_owner.accounts[0]=AccountMeta::new(h.creator.pubkey(),true);
        let creator=h.creator.insecure_clone();assert!(h.send(wrong_owner,&[&creator]).is_err());
        assert!(h.send(h.trade_ix(false,q,refund+1,1090),&[&buyer]).is_err());
        h.send(h.trade_ix(false,q,refund,1090),&[&buyer]).unwrap();assert_eq!(h.market_state(),(CAP-q,cost(CAP-q)));
        h.send(h.trade_ix(true,q,refund,1090),&[&buyer]).unwrap();assert_eq!(h.market_state(),(CAP,cost(CAP)));
        h.send(h.trade_ix(false,CAP,cost(CAP),1090),&[&buyer]).unwrap();assert_eq!(h.market_state(),(0,0));assert_eq!(h.svm.get_balance(&h.market).unwrap(),rent+1000);
        assert_eq!(h.token_amount(h.locked),LOCKED);assert_eq!(h.token_amount(h.curve),CAP);
    }
    #[test]
    fn only_config_authority_can_pause_and_wrong_mint_never_moves_sol() {
        let mut h=Harness::new();h.setup();let authority=h.authority.insecure_clone();let buyer=h.buyer.insecure_clone();
        let configure=|signer:Address,paused:bool|{let mut data=disc("configure");data.extend(h.registrar.pubkey().as_ref());data.push(paused as u8);
            Instruction{program_id:h.program,accounts:vec![AccountMeta::new_readonly(signer,true),rw(h.config)],data}};
        let bad=configure(buyer.pubkey(),true);
        let pause=configure(authority.pubkey(),true);
        let resume=configure(authority.pubkey(),false);
        assert!(h.send(bad,&[&buyer]).is_err());h.send(pause,&[&authority]).unwrap();
        assert!(h.send(h.trade_ix(true,1_000_000_000_000,u64::MAX,1090),&[&buyer]).is_err());assert_eq!(h.market_state(),(0,0));
        h.send(resume,&[&authority]).unwrap();
        let mut wrong=h.trade_ix(true,1_000_000_000_000,u64::MAX,1090);wrong.accounts[3]=ro(h.locked);
        let backing=h.svm.get_balance(&h.market).unwrap();assert!(h.send(wrong,&[&buyer]).is_err());assert_eq!(h.svm.get_balance(&h.market).unwrap(),backing);
        h.send(h.trade_ix(true,1_000_000_000_000,u64::MAX,1090),&[&buyer]).unwrap();assert_eq!(h.market_state().0,1_000_000_000_000);
    }
}
