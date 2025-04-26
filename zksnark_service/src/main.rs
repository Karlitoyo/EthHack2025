// Place this at the top
use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use bellperson::gadgets::boolean::Boolean;
use bellperson::gadgets::num::AllocatedNum;
use bellperson::groth16::{
    create_random_proof, generate_random_parameters, prepare_verifying_key, verify_proof, Proof,
};
use bellperson::{Circuit, ConstraintSystem, SynthesisError};
use blstrs::Bls12;
use blstrs::Scalar as Fr; // Use Fr from blstrs
use ff::PrimeField;
use lazy_static::lazy_static;
use neptune::circuit::poseidon_hash;
use neptune::poseidon::{Poseidon, PoseidonConstants};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use typenum::{U3, U2};
pub const MERKLE_PATH_LEN: usize = 3; // For a tree with 16 leaves

#[derive(Deserialize, Debug)]
pub struct ProofRequest {
    pub hospital_id: String,
    pub treatment: String,
    pub patient_id: String,
    pub merkle_leaf_index: u64,
    pub merkle_path: Vec<String>, // Each as a hex string for each sibling hash
    pub merkle_root: String,      // hex string for the root hash
}

#[derive(Serialize, Deserialize)]
pub struct ProofResponse {
    proof: Vec<u8>,
    public_inputs: Vec<Vec<u8>>, // Each public input is a 32-byte array
}

#[derive(Clone)]
pub struct MyCircuit {
    pub hospital_id: Option<Fr>,
    pub treatment: Option<Fr>,
    pub patient_id: Option<Fr>,
    pub leaf_index: Option<u64>,
    pub merkle_path: Vec<Option<Fr>>, // Length must be MERKLE_PATH_LEN!
    pub merkle_root: Option<Fr>,
    pub preimage_commitment: Option<Fr>,
}

fn string_to_fr(s: &str) -> blstrs::Scalar {
    use blstrs::Scalar as Fr;
    use num_bigint::BigUint;
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(s.as_bytes());
    let hash_int = BigUint::from_bytes_be(&hash);
    // Use a hardcoded modulus if MODULUS is a string
    let modulus = BigUint::parse_bytes(
        b"73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001",
        16,
    )
    .unwrap();
    let reduced = hash_int % &modulus;
    let mut reduced_bytes = reduced.to_bytes_be();
    if reduced_bytes.len() < 32 {
        let mut tmp = vec![0u8; 32 - reduced_bytes.len()];
        tmp.extend_from_slice(&reduced_bytes);
        reduced_bytes = tmp;
    }
    let arr: [u8; 32] = reduced_bytes.as_slice().try_into().unwrap();
    Fr::from_bytes_be(&arr).unwrap()
}

fn print_params_hash(path: &str) {
    use sha2::{Digest, Sha256};
    if let Ok(bytes) = fs::read(path) {
        let hash = Sha256::digest(&bytes);
        println!("PARAMS FILE: {} HASH: {:x}", path, hash);
    } else {
        println!("PARAMS FILE MISSING: {}", path);
    }
}

fn circuit_hash() -> Vec<u8> {
    use sha2::{Digest, Sha256};
    // Compose anything that would change if the circuit changes!
    let mut hasher = Sha256::new();
    hasher.update(b"poseidon-merkle-circuit-v3"); // Bump this for changes!
    hasher.update(b"MERKLE_PATH_LEN");
    hasher.update(&MERKLE_PATH_LEN.to_le_bytes());
    hasher.finalize().to_vec()
}

fn init_params() {
    let params_path = "zkp-params/groth16_params.bin";
    let hash_path = "zkp-params/params.circuit_hash";
    let expected_hash = circuit_hash();
    let params;
    // Check if params file exists
    if Path::new(params_path).exists() {
        println!("Loading SNARK parameters from file...");
        let mut fp = fs::File::open(params_path).expect("Failed to open Groth16 params file");
        params = bellperson::groth16::Parameters::<Bls12>::read(&mut fp, false)
            .expect("Failed to read Groth16 parameters");
        if Path::new(hash_path).exists() {
            let got_hash = fs::read(hash_path).expect("Cannot read circuit hash file");
            if got_hash != expected_hash {
                eprintln!("❌ CIRCUIT HASH MISMATCH: Params file does not match this circuit!");
                eprintln!("Expected:   {}", hex::encode(&expected_hash));
                eprintln!("Found file: {}", hex::encode(&got_hash));
                eprintln!("❌ Delete zkp-params/* and rerun trusted setup!");
                std::process::exit(1);
            } else {
                println!("✔️  Circuit hash matches: {}", hex::encode(&expected_hash));
            }
        } else {
            fs::write(hash_path, &expected_hash).expect("Failed to write circuit hash");
            println!(
                "Wrote missing circuit hash for params: {}",
                hex::encode(&expected_hash)
            );
        }
    } else {
        println!("groth16_params.bin not found, running trusted setup to create it");
        fs::create_dir_all("zkp-params").expect("Could not create parameter output directory");
        params = generate_random_parameters::<Bls12, _, _>(
            MyCircuit {
                hospital_id: None,
                treatment: None,
                patient_id: None,
                leaf_index: None,
                merkle_path: vec![None; MERKLE_PATH_LEN],
                merkle_root: None,
                preimage_commitment: None,
            },
            &mut OsRng,
        )
        .expect("parameter generation failed");
        let mut fp = fs::File::create(params_path).expect("Could not create params file");
        params.write(&mut fp).expect("Failed to write params");
        fs::write(hash_path, &expected_hash).expect("Failed to write circuit hash");
        println!("✅ Params saved to {}", params_path);
        println!(
            "✅ Circuit hash written to {}: {}",
            hash_path,
            hex::encode(&expected_hash)
        );
    }
    println!("CODE circuit_hash:  {}", hex::encode(&expected_hash));
    match fs::read(hash_path) {
        Ok(bytes) => println!("FILE circuit_hash:  {}", hex::encode(bytes)),
        Err(e) => println!("(Couldn't read params.circuit_hash: {})", e),
    }
    print_params_hash(params_path);
    let pvk = prepare_verifying_key(&params.vk);
    *PARAMS.lock().unwrap() = Some((params, pvk));
}


/// === CRITICAL FIX: Merkle node hash must use U2 (arity-2) in-circuit ===
impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        // 1. Allocate secret preimage values (hospital, treatment, patient)
        let hospital_id = AllocatedNum::alloc(cs.namespace(|| "hospital_id"), || {
            self.hospital_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let treatment = AllocatedNum::alloc(cs.namespace(|| "treatment"), || {
            self.treatment.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let patient_id = AllocatedNum::alloc(cs.namespace(|| "patient_id"), || {
            self.patient_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        // 2. Poseidon hash the tuple as the leaf hash: U3!
        let poseidon_constants = PoseidonConstants::<Fr, U3>::new();
        let leaf = poseidon_hash(
            cs.namespace(|| "poseidon_leaf"),
            vec![hospital_id.clone(), treatment.clone(), patient_id.clone()],
            &poseidon_constants,
        )?;
        // 3. Merkle path: Prove leaf is in tree with public root
        let mut cur_hash = leaf.clone();

        let path = self
            .merkle_path
            .iter()
            .enumerate()
            .map(|(i, opt)| {
                AllocatedNum::alloc(cs.namespace(|| format!("merkle_path_{}", i)), || {
                    opt.ok_or(SynthesisError::AssignmentMissing)
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let index = self.leaf_index.unwrap_or(0);
        let mut leaf_index_bits = Vec::new();
        for i in 0..path.len() {
            leaf_index_bits.push((index >> i) & 1 == 1);
        }

        // <== MAIN FIX: Hash w/ U2 not U3!
        // Traverse up the tree
        for (i, (sibling, bit)) in path.iter().zip(leaf_index_bits.iter()).enumerate() {
            let (left, right) = if *bit {
                (sibling, &cur_hash)
            } else {
                (&cur_hash, sibling)
            };
            cur_hash = poseidon_hash(
                cs.namespace(|| format!("merkle_hash_up_{}", i)),
                vec![left.clone(), right.clone()],
                &PoseidonConstants::<Fr, U2>::new(),    // <-- USE U2 FOR NODES
            )?;
            // Diagnostic
            println!(
                "CIRCUIT: After round {}: cur_hash = {:?}",
                i,
                cur_hash.get_value()
            );
        }
        // Allocate Merkle root as public input
        let root_var = cs.alloc_input(
            || "merkle root",
            || self.merkle_root.ok_or(SynthesisError::AssignmentMissing),
        )?;
        // Enforce computed root == public input
        cs.enforce(
            || "tree path leads to public root",
            |lc| lc + cur_hash.get_variable(),
            |lc| lc + CS::one(),
            |lc| lc + root_var,
        );
        // Final circuit diagnostic printout for comparison
        if let Some(final_hash) = cur_hash.get_value() {
            println!(
                "(Hex) In-circuit Merkle root: {}",
                hex::encode(final_hash.to_repr())
            );
            if let Some(expected) = self.merkle_root {
                // Diagnostic equality
                println!(
                    "(Match off-circuit root?) {}",
                    final_hash == expected
                );
            }
        }

        // 4. Range check: patient_id < 2^20
        let bits: Vec<Boolean> = patient_id.to_bits_le(cs.namespace(|| "patient_id_bits"))?;
        for (i, bit) in bits.iter().enumerate().skip(20) {
            Boolean::enforce_equal(
                cs.namespace(|| format!("range bit[{}] zero", i)),
                bit,
                &Boolean::constant(false),
            )?;
        }

        // 5. Preimage commitment: public input = Poseidon(hospital_id, treatment, patient_id)
        let comm_var = cs.alloc_input(
            || "preimage commitment",
            || {
                self.preimage_commitment
                    .ok_or(SynthesisError::AssignmentMissing)
            },
        )?;
        cs.enforce(
            || "public commitment is poseidon(hospital, treatment, patient)",
            |lc| lc + leaf.get_variable(),
            |lc| lc + CS::one(),
            |lc| lc + comm_var,
        );

        Ok(())
    }
}

lazy_static! {
    static ref PARAMS: Mutex<
        Option<(
            bellperson::groth16::Parameters<Bls12>,
            bellperson::groth16::PreparedVerifyingKey<Bls12>,
        )>,
    > = Mutex::new(None);
}

#[post("/generate-proof")]
async fn generate_proof(input: web::Json<ProofRequest>) -> impl Responder {
    // Logging input
    println!("--- Incoming ProofRequest ---");
    println!("hospital_id: {:?}", input.hospital_id);
    println!("treatment:   {:?}", input.treatment);
    println!("patient_id:  {:?}", input.patient_id);
    println!("merkle_leaf_index: {}", input.merkle_leaf_index);

    // Map fields to Fr
    let hospital_id_fr = string_to_fr(&input.hospital_id);
    let treatment_fr = string_to_fr(&input.treatment);
    let patient_id_fr = string_to_fr(&input.patient_id);

    // Poseidon leaf/commitment for public input "preimage_commitment"
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon.input(hospital_id_fr).expect("input hospital");
    poseidon.input(treatment_fr).expect("input treatment");
    poseidon.input(patient_id_fr).expect("input patient");
    let commitment = poseidon.hash();
    println!("(Hex) Off-circuit commitment: {}", hex::encode(commitment.to_repr()));

    // Parse Merkle path
    let mut actual_merkle_path = vec![];
    for (_i, hex_sibling) in input.merkle_path.iter().enumerate() {
        let bytes = hex::decode(hex_sibling.trim_start_matches("0x")).unwrap();
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        let fr = blstrs::Scalar::from_repr(arr).unwrap();
        actual_merkle_path.push(Some(fr));
    }
    // Parse Merkle root for public input "merkle_root"
    let merkle_root_bytes = hex::decode(input.merkle_root.trim_start_matches("0x")).unwrap();
    let mut root_arr = [0u8; 32];
    root_arr.copy_from_slice(&merkle_root_bytes[..]);
    let actual_merkle_root = Fr::from_repr(root_arr).unwrap();
    println!("(Hex) Off-circuit Merkle Root: {}", hex::encode(actual_merkle_root.to_repr()));

    // DIAGNOSTIC: Off-circuit Merkle root computation step-by-step
    println!("==== Off-circuit Merkle path debug ====");
    let mut debug_cur = commitment;
    let index = input.merkle_leaf_index;
    for (i, raw_sib) in input.merkle_path.iter().enumerate() {
        let bytes = hex::decode(raw_sib.trim_start_matches("0x")).unwrap();
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        let sibling = blstrs::Scalar::from_repr(arr).unwrap();
        let bit = (index >> i) & 1;
        let (left, right) = if bit == 1 {
            (sibling, debug_cur)
        } else {
            (debug_cur, sibling)
        };
        let constants = PoseidonConstants::<Fr, U2>::new();
        let mut poseidon = Poseidon::new(&constants);
        poseidon.input(left).unwrap();
        poseidon.input(right).unwrap();
        debug_cur = poseidon.hash();
        println!(
            "Level {}: Poseidon([{}, {}]) = {}",
            i,
            hex::encode(left.to_repr()),
            hex::encode(right.to_repr()),
            hex::encode(debug_cur.to_repr())
        );
    }
    println!(
        "(Hex) Final off-circuit Merkle root: {}",
        hex::encode(debug_cur.to_repr())
    );

    // ---- End diagnostics ----

    // Prepare public inputs: root (0), commitment (1)
    let mut root_bytes = [0u8; 32];
    root_bytes.copy_from_slice(&actual_merkle_root.to_repr());
    let mut comm_bytes = [0u8; 32];
    comm_bytes.copy_from_slice(&commitment.to_repr());

    // Generate proof
    let params_guard = PARAMS.lock().unwrap();
    if params_guard.is_none() {
        return HttpResponse::InternalServerError().json("Parameters not initialized");
    }
    let (params, _) = params_guard.as_ref().unwrap();
    let proof = match create_random_proof(
        MyCircuit {
            hospital_id: Some(hospital_id_fr),
            treatment: Some(treatment_fr),
            patient_id: Some(patient_id_fr),
            leaf_index: Some(input.merkle_leaf_index),
            merkle_path: actual_merkle_path.clone(),
            merkle_root: Some(actual_merkle_root),
            preimage_commitment: Some(commitment),
        },
        params,
        &mut OsRng,
    ) {
        Ok(p) => p,
        Err(e) => {
            println!("  [ERR] ZK Proof error: {:?}", e);
            return HttpResponse::InternalServerError().json("Proof generation failed");
        }
    };

    // Serialize the proof
    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();
    let result = verify_proof(&prepare_verifying_key(&params.vk), &proof, &[actual_merkle_root, commitment]);
    dbg!(&result);
    // Log the values (for frontend or manual debug)
    println!("Public input[0] (merkle root, LE): {}", hex::encode(&root_bytes));
    println!("Public input[1] (commitment, LE):   {}", hex::encode(&comm_bytes));
    println!("Proof (hex): {}", hex::encode(&proof_bytes));
    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_inputs: vec![root_bytes.to_vec(), comm_bytes.to_vec()], // <----- Correct!
    })
}

#[post("/verify-proof")]
async fn verify_proof_endpoint(
    proof_data: web::Json<ProofResponse>,
) -> Result<HttpResponse, actix_web::Error> {
    println!("=== VERIFY PROOF ===");

    // Validate the number of public inputs
    if proof_data.public_inputs.len() != 2 {
        println!("Error: Expected 2 public inputs, but got {}", proof_data.public_inputs.len());
        return Ok(HttpResponse::BadRequest().json("Expected 2 public inputs"));
    }

    // Validate the length of each public input
    for (i, inp) in proof_data.public_inputs.iter().enumerate() {
        if inp.len() != 32 {
            println!("Error: Public input {} is not 32 bytes (it has length {})", i, inp.len());
            return Ok(
                HttpResponse::BadRequest().json(format!("Public input {} must be 32 bytes", i))
            );
        }
    }

    // Convert the first public input to Fr (Merkle root)
    let mut buf0 = [0u8; 32];
    buf0.copy_from_slice(&proof_data.public_inputs[0][..32]);
    let fr0 = Fr::from_repr(buf0).unwrap();  // <-- no reverse
    println!("Public input 0 (fr0 - Merkle root): {}", hex::encode(fr0.to_repr()));
    println!("Public input[1] bytes: {}", hex::encode(&proof_data.public_inputs[1]));
    println!("Public input[0] bytes (BE): {}", hex::encode(buf0));
    // Convert the second public input to Fr (commitment)
    let mut buf1 = [0u8; 32];
    println!("Public input[1] bytes (BE): {}", hex::encode(buf1));
    buf1.copy_from_slice(&proof_data.public_inputs[1][..32]);
    let fr0_option = Fr::from_repr(buf0);
    let fr0 = if fr0_option.is_some().into() {
        fr0_option.unwrap()
    } else {
        println!("Invalid Fr for public input 0");
        return Ok(HttpResponse::BadRequest().json("Invalid Fr for public input 0"));
    };

    let fr1_option = Fr::from_repr(buf1);
    let fr1 = if fr1_option.is_some().into() {
        fr1_option.unwrap()
    } else {
        println!("Invalid Fr for public input 1");
        return Ok(HttpResponse::BadRequest().json("Invalid Fr for public input 1"));
    };

    let public_input = vec![fr0, fr1];

    // Read the proof from the input and check for errors
    let proof: Proof<Bls12> = match Proof::<Bls12>::read(&mut Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Error: Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };
    println!("Proof data (hex): {}", hex::encode(&proof_data.proof));

    // Get the parameters for verification
    let params_guard = PARAMS.lock().unwrap();
    let (_, pvk) = params_guard.as_ref().unwrap();
    let verification_result = verify_proof(&pvk, &proof, &public_input);
    // ... respond as before

    // Add timing measurement
    let now = std::time::Instant::now();
    println!("verify_proof returned in {} ms", now.elapsed().as_millis());

    println!("[VERIFY] Verification result: {:?}", verification_result);
    println!("Verifying with public_input[0]: {}", fr0);
    println!("Verifying with public_input[1]: {}", fr1);
    println!("Proof: {}", hex::encode(&proof_data.proof));

    // Return the result of the match directly, removing redundant code
    match verification_result {
        Ok(true) => {
            println!("✔️ Proof verified successfully.");
            Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
        }
        Ok(false) => {
            println!("❌ Proof verification failed.");
            Ok(HttpResponse::Ok().json(json!({"valid": false, "message": "Proof is invalid"})))
        }
        Err(e) => {
            println!("❌ Proof verification error: {:?}", e);
            Ok(HttpResponse::BadRequest().json(format!("Proof verification error: {:?}", e)))
        }
    }
}



fn poseidon_diag_vector() {
    let a = Fr::from(1234567890u64);
    let b = Fr::from(9876543210u64);
    let c = Fr::from(4444444u64);
    let cons2 = PoseidonConstants::<Fr, U2>::new();
    let cons3 = PoseidonConstants::<Fr, U3>::new();

    let mut h2 = Poseidon::new(&cons2);
    h2.input(a).unwrap();
    h2.input(b).unwrap();
    let res2 = h2.hash();
    println!("=== POSEIDON DIAG VECTORS (OFF-CIRCUIT) ===");
    println!("U2: inputs: {}, {}", a, b);
    println!("U2: hash:   {}", hex::encode(res2.to_repr()));

    let mut h3 = Poseidon::new(&cons3);
    h3.input(a).unwrap();
    h3.input(b).unwrap();
    h3.input(c).unwrap();
    let res3 = h3.hash();
    println!("U3: inputs: {}, {}, {}", a, b, c);
    println!("U3: hash:   {}", hex::encode(res3.to_repr()));
}

#[derive(Debug, Deserialize)]
pub struct PoseidonHashRequest {
    inputs: Vec<String>, // Inputs as strings, or hex
}
#[derive(Debug, Serialize)]
pub struct PoseidonHashResponse {
    hash: String,
}

#[post("/poseidon-hash")]
async fn poseidon_hash_endpoint(req: web::Json<PoseidonHashRequest>) -> impl Responder {
    let frs: Vec<Fr> = match req
        .inputs
        .iter()
        .map(|s| {
            if s.starts_with("0x") {
                println!("Parsing {} as field element", s);
                let bytes = match hex::decode(s.trim_start_matches("0x")) {
                    Ok(b) => b,
                    Err(_) => return Err("Invalid hex in poseidon-hash input"),
                };
                if bytes.len() != 32 {
                    return Err("Hex in poseidon-hash input is not 32 bytes");
                }
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                let fr_option = Fr::from_repr(arr);
                if fr_option.is_some().into() {
                    Ok(fr_option.unwrap())
                } else {
                    Err("Input not a valid Fr")
                }
            } else {
                println!("Parsing {} as string_to_fr", s);
                Ok(string_to_fr(s))
            }
        })
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(frs) => frs,
        Err(e) => return HttpResponse::BadRequest().body(e),
    };
    let arity = frs.len();
    let hash = match arity {
        2 => {
            let constants = PoseidonConstants::<Fr, U2>::new();
            let mut poseidon = Poseidon::new(&constants);
            poseidon.input(frs[0]).unwrap();
            poseidon.input(frs[1]).unwrap();
            poseidon.hash()
        }
        3 => {
            let constants = PoseidonConstants::<Fr, U3>::new();
            let mut poseidon = Poseidon::new(&constants);
            poseidon.input(frs[0]).unwrap();
            poseidon.input(frs[1]).unwrap();
            poseidon.input(frs[2]).unwrap();
            poseidon.hash()
        }
        _ => return HttpResponse::BadRequest().json("Arity must be 2 or 3"),
    };
    let bytes = hash.to_repr();
    HttpResponse::Ok().json(PoseidonHashResponse {
        hash: format!("0x{}", hex::encode(bytes)),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    poseidon_diag_vector();
    init_params();
    let hospital_id = string_to_fr("df670909-2073-426c-b3e2-3878b9b8caab");
    let treatment = string_to_fr("Burn");
    let patient_id = string_to_fr("123");
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon.input(hospital_id).unwrap();
    poseidon.input(treatment).unwrap();
    poseidon.input(patient_id).unwrap();
    let leaf = poseidon.hash();
    println!(
        "\nRUST Test Poseidon(hospital, treatment, patient) = {}",
        hex::encode(leaf.to_repr())
    );

    HttpServer::new(|| {
        App::new()
            .service(generate_proof)
            .service(verify_proof_endpoint)
            .service(poseidon_hash_endpoint)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
