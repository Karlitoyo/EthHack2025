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
use ring::digest;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use typenum::U3;

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

// Produces a hash identifying the circuit version/configuration for param binding
fn circuit_hash() -> Vec<u8> {
    use sha2::{Digest, Sha256};
    // Compose anything that would change if the circuit changes!
    let mut hasher = Sha256::new();
    hasher.update(b"poseidon-merkle-circuit-v1"); // Change this if you change logic!
    hasher.update(b"MERKLE_PATH_LEN");
    hasher.update(&MERKLE_PATH_LEN.to_le_bytes());
    // Add signature of any other circuit 'shape' constants here!
    hasher.finalize().to_vec()
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
    use std::fs;
    if let Ok(bytes) = fs::read(path) {
        let hash = Sha256::digest(&bytes);
        println!("PARAMS FILE: {} HASH: {:x}", path, hash);
    } else {
        println!("PARAMS FILE MISSING: {}", path);
    }
}

fn init_params() {
    let params_path = "zkp-params/groth16_params.bin";
    let hash_path = "zkp-params/params.circuit_hash";
    let expected_hash = circuit_hash();
    let params;

    // Check if params file exists
    if Path::new(params_path).exists() {
        println!("Loading SNARK parameters from file...");
        // Load params
        let mut fp = fs::File::open(params_path).expect("Failed to open Groth16 params file");
        params = bellperson::groth16::Parameters::<Bls12>::read(&mut fp, false)
            .expect("Failed to read Groth16 parameters");

        // Load/write/check circuit hash file
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
            // Legacy: hash file missing—write it now
            fs::write(hash_path, &expected_hash).expect("Failed to write circuit hash");
            println!(
                "Wrote missing circuit hash for params: {}",
                hex::encode(&expected_hash)
            );
        }
    } else {
        // Params file does not exist—run trusted setup
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

        // Save params and circuit hash
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

    // Always log
    println!("CODE circuit_hash:  {}", hex::encode(&expected_hash));
    match fs::read(hash_path) {
        Ok(bytes) => println!("FILE circuit_hash:  {}", hex::encode(bytes)),
        Err(e) => println!("(Couldn't read params.circuit_hash: {})", e),
    }
    print_params_hash(params_path);

    let pvk = prepare_verifying_key(&params.vk);
    *PARAMS.lock().unwrap() = Some((params, pvk));
}

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

        // 2. Poseidon hash the tuple as the leaf hash
        let poseidon_constants = PoseidonConstants::<Fr, U3>::new();
        let leaf = poseidon_hash(
            cs.namespace(|| "poseidon_leaf"),
            vec![hospital_id.clone(), treatment.clone(), patient_id.clone()],
            &poseidon_constants,
        )?;

        // 3. Merkle path: Prove leaf is in tree with public root
        // Allocate path elements (sibling hashes)
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

        // Allocate leaf index bits for direction
        let index = self.leaf_index.unwrap_or(0);
        let mut leaf_index_bits = Vec::new();
        for i in 0..path.len() {
            leaf_index_bits.push((index >> i) & 1 == 1);
        }

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
                &PoseidonConstants::<Fr, U3>::new(),
            )?;
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
    println!("\n--- Incoming ProofRequest ---");
    println!("hospital_id: {:?}", input.hospital_id);
    println!("treatment:   {:?}", input.treatment);
    println!("patient_id:  {:?}", input.patient_id);
    println!("merkle_leaf_index: {}", input.merkle_leaf_index);
    print_params_hash("zkp-params/groth16_params.bin");
    println!("Merkle Path (hex):");
    for (i, h) in input.merkle_path.iter().enumerate() {
        println!("  [{:2}] {}", i, h);
    }
    println!("Merkle Root (hex): {}", input.merkle_root);
    println!("HOSTNAME: {:?}", hostname::get());
    println!(
        "BUILD: {}",
        std::env::var("VERGEN_GIT_SHA").unwrap_or_else(|_| "development".to_string())
    );
    println!(
        "Binary hash: {}",
        match std::fs::read("/proc/self/exe") {
            Ok(bin) => hex::encode(sha2::Sha256::digest(&bin)),
            Err(e) => format!("(error reading binary: {})", e),
        }
    );
    println!("circuit_hash: {}", hex::encode(circuit_hash()));
    print_params_hash("zkp-params/groth16_params.bin");

    // Check merkle path length
    if input.merkle_path.len() != MERKLE_PATH_LEN {
        return HttpResponse::BadRequest().json(format!(
            "Merkle path must have {} siblings, got {}",
            MERKLE_PATH_LEN,
            input.merkle_path.len()
        ));
    }

    // Map all patient fields to field elements
    let hospital_id_fr = string_to_fr(&input.hospital_id);
    let treatment_fr = string_to_fr(&input.treatment);
    let patient_id_fr = string_to_fr(&input.patient_id);

    println!(
        "Converted hospital_id_fr: {}",
        hex::encode(hospital_id_fr.to_repr())
    );
    println!(
        "Converted treatment_fr:  {}",
        hex::encode(treatment_fr.to_repr())
    );
    println!(
        "Converted patient_id_fr: {}",
        hex::encode(patient_id_fr.to_repr())
    );

    // Poseidon leaf/commitment for public input "preimage_commitment"
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon.input(hospital_id_fr).expect("input hospital");
    poseidon.input(treatment_fr).expect("input treatment");
    poseidon.input(patient_id_fr).expect("input patient");
    let commitment = poseidon.hash();

    println!(
        "Poseidon leaf/commitment: {}",
        hex::encode(commitment.to_repr())
    );

    // Parse Merkle path
    let mut actual_merkle_path = vec![];
    for (i, hex_sibling) in input.merkle_path.iter().enumerate() {
        println!("Decoding merkle_path[{}]: {}", i, hex_sibling);
        let bytes = match hex::decode(hex_sibling.trim_start_matches("0x")) {
            Ok(b) => b,
            Err(e) => {
                println!("  [ERR] Invalid hex: {:?}", e);
                return HttpResponse::BadRequest().json(format!(
                    "Invalid hex in merkle path[{}]: {}",
                    i, hex_sibling
                ));
            }
        };
        if bytes.len() != 32 {
            println!("  [ERR] Not 32 bytes (got {})", bytes.len());
            return HttpResponse::BadRequest().json(format!(
                "Merkle sibling hash must be 32 bytes, got {}",
                bytes.len()
            ));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        let fr_option = Fr::from_repr(arr);
        if fr_option.is_some().into() {
            let fr = fr_option.unwrap();
            println!("  [OK ] Parses as Fr");
            actual_merkle_path.push(Some(fr));
        } else {
            println!("  [ERR] Bytes not valid Fr: {:?}", arr);
            return HttpResponse::BadRequest().json(format!(
                "Merkle path[{}] bytes not valid Fr: {}",
                i, hex_sibling
            ));
        }
    }

    // Parse Merkle root for public input "merkle_root"
    println!("Parsing Merkle Root...");
    let merkle_root_bytes = match hex::decode(input.merkle_root.trim_start_matches("0x")) {
        Ok(b) => b,
        Err(e) => {
            println!("  [ERR] Invalid hex for root: {:?}", e);
            return HttpResponse::BadRequest().json("Invalid hex in merkle_root");
        }
    };
    if merkle_root_bytes.len() != 32 {
        println!(
            "  [ERR] merkle_root is not 32 bytes (got {})",
            merkle_root_bytes.len()
        );
        return HttpResponse::BadRequest().json("Merkle root must be 32 bytes");
    }
    let mut root_arr = [0u8; 32];
    root_arr.copy_from_slice(&merkle_root_bytes[..]);
    let merkle_root_option = Fr::from_repr(root_arr);
    let actual_merkle_root = if merkle_root_option.is_some().into() {
        println!("  [OK ] merkle_root parses as Fr\n");
        merkle_root_option.unwrap()
    } else {
        println!("  [ERR] merkle_root bytes not valid Fr: {:?}", root_arr);
        return HttpResponse::BadRequest().json("Invalid Fr for merkle_root");
    };

    // Prepare the two public inputs in the same order as circuit alloc_input:
    // 1. Merkle root (first alloc_input)
    // 2. Commitment (second alloc_input)
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

    println!(
        "Proof bytes (hex, first 16): {}",
        hex::encode(&proof_bytes[..16.min(proof_bytes.len())])
    );
    println!(
        "Public input[0] (merkle root): {}",
        hex::encode(&root_bytes)
    );
    println!(
        "Public input[1] (commitment):   {}",
        hex::encode(&comm_bytes)
    );
    println!("Proof: {}", hex::encode(&proof_bytes));
    println!("--- PROOF RESPONSE END ---");

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
    // ... diagnostics as before

    // Expect exactly 2 public inputs, both 32-byte arrays
    if proof_data.public_inputs.len() != 2 {
        println!(
            "Invalid number of public inputs: expected 2, got {}",
            proof_data.public_inputs.len()
        );
        return Ok(HttpResponse::BadRequest().json("Expected 2 public inputs"));
    }
    for (i, inp) in proof_data.public_inputs.iter().enumerate() {
        if inp.len() != 32 {
            println!("Public input {} not 32 bytes: {:?}", i, inp);
            return Ok(
                HttpResponse::BadRequest().json(format!("Public input {} must be 32 bytes", i))
            );
        }
    }
    let mut buf0 = [0u8; 32];
    buf0.copy_from_slice(&proof_data.public_inputs[0][..32]);
    let mut buf1 = [0u8; 32];
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

    // Parse proof as before
    let proof: Proof<Bls12> = match Proof::<Bls12>::read(&mut Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };
    // ... verify as before
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

    match verification_result {
        Ok(true) => {
            println!("Proof verified? true");
            Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
        }
        Ok(false) => {
            println!("Proof verified? false (invalid proof)");
            Ok(HttpResponse::Ok().json(json!({"valid": false, "message": "Proof is invalid"})))
        }
        Err(e) => {
            println!("Error during proof verification: {:?}", e);
            Ok(HttpResponse::InternalServerError()
                .json(json!({"valid": false, "message": format!("Verifier error: {:?}", e)})))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    init_params();
    // println!("=== ZK Proof Service ===");
    // println!("Loading SNARK parameters...");
    // let hash_path = "zkp-params/params.circuit_hash";

    // // Read the circuit_hash file, if present
    // match fs::read(hash_path) {
    //     Ok(bytes) => {
    //         println!("circuit_hash from file: {}", hex::encode(&bytes));
    //     }
    //     Err(e) => {
    //         eprintln!("Error reading circuit_hash: {}", e);
    //     }
    // }

    // match std::fs::read(hash_path) {
    //     Ok(bytes) => println!("FILE circuit_hash: {}", hex::encode(bytes)),
    //     Err(e) => println!("Couldn't read params.circuit_hash: {}", e),
    // }

    // // Compute the hash according to your circuit_hash() function
    // let mut hasher = Sha256::new();
    // hasher.update(b"poseidon-merkle-circuit-v1");
    // hasher.update(b"MERKLE_PATH_LEN");
    // hasher.update(&MERKLE_PATH_LEN.to_le_bytes());
    // let expected_hash = hasher.finalize();
    // println!("circuit_hash from code:  {}", hex::encode(&expected_hash));
    // println!("CODE circuit_hash: {}", hex::encode(circuit_hash()));
    // println!("🚀 Starting Zero-Knowledge Proof service on http://localhost:8080");
    // println!(
    //     "BUILD: {}",
    //     std::env::var("VERGEN_GIT_SHA").unwrap_or_else(|_| "development".to_string())
    // ); // Fetch at runtime
    HttpServer::new(|| {
        App::new()
            .service(generate_proof)
            .service(verify_proof_endpoint)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
