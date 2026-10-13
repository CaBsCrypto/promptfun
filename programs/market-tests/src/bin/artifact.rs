use sha2::{Digest,Sha256};
use std::{env,fs,path::PathBuf,str::FromStr};
use solana_address::Address;
fn main() {
    let args:Vec<String>=env::args().skip(1).collect();
    assert_eq!(args.len(),2,"artifact OUTPUT_DIRECTORY SOURCE_DIRECTORY");
    let out=PathBuf::from(&args[0]);
    let source=PathBuf::from(&args[1]);
    let code=fs::read_to_string(source.join("programs/promptfun-market/src/lib.rs")).unwrap();
    let id=code.split("declare_id!(\"").nth(1).unwrap().split('"').next().unwrap();
    Address::from_str(id).expect("invalid declared public program ID");
    let bytes=fs::read(out.join("promptfun_market.so")).unwrap();assert_eq!(&bytes[..4],b"\x7fELF");
    let idl_path=out.join("promptfun_market.json");
    let mut idl:serde_json::Value=serde_json::from_slice(&fs::read(&idl_path).unwrap()).unwrap();
    idl["address"]=serde_json::Value::String(id.to_string());
    fs::write(idl_path,serde_json::to_vec_pretty(&idl).unwrap()).unwrap();
    let manifest=serde_json::json!({"program_id":id,"sha256":format!("{:x}",Sha256::digest(&bytes)),
        "anchor":"1.2.1","platform_tools":"v1.57","arch":"v3","litesvm":"0.13.1",
        "rust_math_tests":3,"sbf_tests":3,"source_commit":env::var("GITHUB_SHA").ok()});
    fs::write(out.join("artifact.json"),serde_json::to_vec_pretty(&manifest).unwrap()).unwrap();
    println!("{}",manifest);
}
