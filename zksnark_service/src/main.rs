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
use std::path::Path;
use std::sync::Mutex;
use typenum::{U2, U3};
pub const MERKLE_PATH_LEN: usize = 3; // For a tree with 16 leaves

#[derive(Serialize, Deserialize, Debug)]
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

    println!("[string_to_fr] Input string: '{}'", s);

    // Step 1: Hash the input string with SHA256
    let hash = Sha256::digest(s.as_bytes());
    println!("[string_to_fr] SHA256 hash: 0x{}", hex::encode(&hash));

    // Step 2: Convert hash to BigUint
    let hash_int = BigUint::from_bytes_be(&hash);
    println!("[string_to_fr] Hash as integer: {}", hash_int);

    // Step 3: Get BLS12-381 scalar field modulus
    let modulus = BigUint::parse_bytes(
        b"73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001",
        16,
    )
    .unwrap();
    println!("[string_to_fr] Field modulus: {}", modulus);

    // Step 4: Reduce the hash modulo the field size
    let reduced = hash_int % &modulus;
    println!("[string_to_fr] Reduced value: {}", reduced);

    // Step 5: Convert to bytes with padding
    let mut reduced_bytes = reduced.to_bytes_be();
    println!(
        "[string_to_fr] Raw bytes (len={}): 0x{}",
        reduced_bytes.len(),
        hex::encode(&reduced_bytes)
    );

    if reduced_bytes.len() < 32 {
        let mut tmp = vec![0u8; 32 - reduced_bytes.len()];
        tmp.extend_from_slice(&reduced_bytes);
        reduced_bytes = tmp;
        println!(
            "[string_to_fr] Padded to 32 bytes: 0x{}",
            hex::encode(&reduced_bytes)
        );
    }

    // Step 6: Convert to Fr
    let arr: [u8; 32] = reduced_bytes.as_slice().try_into().unwrap();
    let result = Fr::from_bytes_be(&arr).unwrap();
    println!(
        "[string_to_fr] Final Fr element (canonical repr): 0x{}",
        hex::encode(result.to_repr())
    );

    result
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
    hasher.update(b"poseidon-merkle-circuit-v5.9.8"); // Bump this for changes!
    hasher.update(b"MERKLE_PATH_LEN");
    hasher.update(&MERKLE_PATH_LEN.to_le_bytes());
    hasher.finalize().to_vec()
}

fn init_params() {
    let params_path = "zkp-params/groth16_params.bin";
    let hash_path = "zkp-params/params.circuit_hash";
    let expected_hash = circuit_hash();

    println!("*** INIT_PARAMS: MERKLE_PATH_LEN = {} ***", MERKLE_PATH_LEN);

    // Create params directory if it doesn't exist
    if !Path::new("zkp-params").exists() {
        fs::create_dir_all("zkp-params").expect("Could not create parameter output directory");
    }

    // Check if we need to regenerate parameters
    let mut need_regen = false;
    
    if !Path::new(params_path).exists() {
        println!("groth16_params.bin not found, will generate new parameters");
        need_regen = true;
    } else if !Path::new(hash_path).exists() {
        println!("Circuit hash file not found, will regenerate parameters");
        need_regen = true;
    } else {
        // Check if hash matches
        let got_hash = fs::read(hash_path).expect("Cannot read circuit hash file");
        println!("Loaded circuit hash from {}: {}", hash_path, hex::encode(&got_hash));
        if got_hash != expected_hash {
            println!("❌ CIRCUIT HASH MISMATCH: Params file does not match this circuit!");
            println!("Expected:   {}", hex::encode(&expected_hash));
            println!("Found file: {}", hex::encode(&got_hash));
            println!("Will regenerate parameters");
            need_regen = true;
        } else {
            println!("✅ Circuit hash matches: {}", hex::encode(&expected_hash));
        }
    }

    let params;

    if need_regen {
        // CRITICAL: Use concrete dummy Fr::from(0) everywhere for Option<T> fields!
        let dummy_zero = Fr::from(0u64);
        println!("Running trusted setup to create new parameters");
        println!("*** Trusted setup circuit instance: ***");
        println!(" MyCircuit {{ hospital_id: Some(zero), treatment: Some(zero), patient_id: Some(zero), leaf_index: Some(0), merkle_path: [Some(zero); {}], merkle_root: Some(zero), preimage_commitment: Some(zero) }}", MERKLE_PATH_LEN);
        
        // Delete existing files if they exist
        if Path::new(params_path).exists() {
            fs::remove_file(params_path).expect("Failed to remove old params file");
        }
        if Path::new(hash_path).exists() {
            fs::remove_file(hash_path).expect("Failed to remove old hash file");
        }
        
        // Generate new parameters
        params = generate_random_parameters::<Bls12, _, _>(
            MyCircuit {
                hospital_id: Some(dummy_zero),
                treatment: Some(dummy_zero),
                patient_id: Some(dummy_zero),
                leaf_index: Some(0),
                merkle_path: vec![Some(dummy_zero); MERKLE_PATH_LEN],
                merkle_root: Some(dummy_zero),
                preimage_commitment: Some(dummy_zero),
            },
            &mut OsRng,
        ).expect("parameter generation failed");
        
        // Save the new parameters and hash
        let mut fp = fs::File::create(params_path).expect("Could not create params file");
        params.write(&mut fp).expect("Failed to write params");
        fs::write(hash_path, &expected_hash).expect("Failed to write circuit hash");
        
        println!("✅ New parameters saved to {}", params_path);
        println!("✅ New circuit hash written to {}: {}", hash_path, hex::encode(&expected_hash));
    } else {
        // Load existing parameters
        println!("Loading SNARK parameters from file...");
        let mut fp = fs::File::open(params_path).expect("Failed to open Groth16 params file");
        params = bellperson::groth16::Parameters::<Bls12>::read(&mut fp, false)
            .expect("Failed to read Groth16 parameters");
    }

    println!("circuit_hash(): {}", hex::encode(circuit_hash()));
    println!("CODE circuit_hash:  {}", hex::encode(&expected_hash));
    print_params_hash(params_path);
    
    // Prepare verifying key
    let pvk = prepare_verifying_key(&params.vk);
    println!("Parameters and verifying key prepared in process.");
    
    // Store parameters in the global variable
    *PARAMS.lock().unwrap() = Some((params, pvk));
}

fn select_allocated<CS: ConstraintSystem<Fr>>(
    mut cs: CS,
    a: &AllocatedNum<Fr>,
    b: &AllocatedNum<Fr>,
    cond: &Boolean,
    name: &str,
) -> Result<AllocatedNum<Fr>, SynthesisError> {
    let value = match (cond.get_value(), a.get_value(), b.get_value()) {
        (Some(true), Some(av), _) => Some(av),
        (Some(false), _, Some(bv)) => Some(bv),
        _ => None,
    };
    let selected = AllocatedNum::alloc(cs.namespace(|| name), || {
        value.ok_or(SynthesisError::AssignmentMissing)
    })?;
    cs.enforce(
        || format!("select {}", name),
        |lc| lc + &cond.lc(CS::one(), Fr::from(1u64)),
        |lc| lc + a.get_variable() - b.get_variable(),
        |lc| lc + selected.get_variable() - b.get_variable(),
    );
    Ok(selected)
}

impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        // 1. Witness allocation (unchanged)
        let hospital_id = AllocatedNum::alloc(cs.namespace(|| "hospital_id"), || {
            self.hospital_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let treatment = AllocatedNum::alloc(cs.namespace(|| "treatment"), || {
            self.treatment.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let patient_id = AllocatedNum::alloc(cs.namespace(|| "patient_id"), || {
            self.patient_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        // REMOVED: let bits: Vec<Boolean> = patient_id.to_bits_le(cs.namespace(|| "patient_id_bits"))?;
        
        // 2. Poseidon leaf
        let poseidon_constants = PoseidonConstants::<Fr, U3>::new();
        let leaf = poseidon_hash(
            cs.namespace(|| "poseidon_leaf"),
            vec![hospital_id.clone(), treatment.clone(), patient_id.clone()],
            &poseidon_constants,
        )?;
        // 3. Allocate merkle path siblings
        let path = self.merkle_path.iter().enumerate().map(|(i, opt)| {
            AllocatedNum::alloc(cs.namespace(|| format!("merkle_path_{}", i)), || {
                opt.ok_or(SynthesisError::AssignmentMissing)
            })
        }).collect::<Result<Vec<_>, _>>()?;

        // 4. Allocate & decompose leaf index as in-circuit booleans
        let leaf_index_num = self.leaf_index.ok_or(SynthesisError::AssignmentMissing)?;
        let leaf_index_alloc = AllocatedNum::alloc(cs.namespace(|| "leaf_index"), || {
            Ok(Fr::from(leaf_index_num))
        })?;
        let mut leaf_index_bits = leaf_index_alloc.to_bits_le(cs.namespace(|| "leaf_index_bits"))?;
        while leaf_index_bits.len() < MERKLE_PATH_LEN {
            leaf_index_bits.push(Boolean::constant(false));
        }
        let leaf_index_bits = &leaf_index_bits[..MERKLE_PATH_LEN];
        
        // 5. Merkle path circuit step, using conditionally_select
        let mut cur_hash = leaf.clone();
        for (i, (sibling, index_bit)) in path.iter().zip(leaf_index_bits).enumerate() {
            let left = select_allocated(cs.namespace(|| format!("left_{}", i)), sibling, &cur_hash, index_bit, "left")?;
            let right = select_allocated(cs.namespace(|| format!("right_{}", i)), &cur_hash, sibling, index_bit, "right")?;
            cur_hash = poseidon_hash(
                cs.namespace(|| format!("merkle_hash_up_{}", i)),
                vec![left, right],
                &PoseidonConstants::<Fr, U2>::new(),
            )?;
        }

        // 6. Enforce root == public input
        let root_var = cs.alloc_input(
            || "merkle root",
            || self.merkle_root.ok_or(SynthesisError::AssignmentMissing),
        )?;
        cs.enforce(
            || "enforce merkle path leads to public root",
            |lc| lc + cur_hash.get_variable(),
            |lc| lc + CS::one(),
            |lc| lc + root_var,
        );
        // 7. REMOVED Range check for patient_id
        /*
        for (i, bit) in bits.iter().enumerate().skip(20) { // Check bits from index 20 upwards
            Boolean::enforce_equal(
                cs.namespace(|| format!("range bit[{}] zero", i)), 
                bit, &Boolean::constant(false)
            )?;
        }
        */
        
        // 8. Enforce public commitment = leaf
        let comm_var = cs.alloc_input(
            || "preimage commitment",
            || self.preimage_commitment.ok_or(SynthesisError::AssignmentMissing),
        )?;
        cs.enforce(
            || "enforce public commitment is poseidon(hospital, treatment, patient)",
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

#[post("/debug-zero-proof")]
async fn debug_zero_proof() -> impl Responder {
    use blstrs::Scalar as Fr;
    use neptune::poseidon::{Poseidon, PoseidonConstants};
    use typenum::{U2, U3};

    // 1. Make dummy witness: all zeros
    let zero = Fr::from(0u64);
    let merkle_path = vec![Some(zero); MERKLE_PATH_LEN];

    // 2. Compute circuit-equivalent commitment and root
    // Commitment is Poseidon(0,0,0)
    let comm_constants = PoseidonConstants::<Fr, U3>::new();
    let mut comm = Poseidon::new(&comm_constants);
    comm.input(zero).unwrap();
    comm.input(zero).unwrap();
    comm.input(zero).unwrap();
    let commitment = comm.hash();

    // Now Merkle root: climbing up using (cur, 0), leaf_index = 0
    let mut cur = commitment;
    for _ in 0..MERKLE_PATH_LEN {
        let constants = PoseidonConstants::<Fr, U2>::new();
        let mut hasher = Poseidon::new(&constants);
        hasher.input(cur).unwrap();
        hasher.input(zero).unwrap();
        cur = hasher.hash();
    }
    let merkle_root = cur;

    // 3. Build proof
    let params_guard = PARAMS.lock().unwrap();
    let (params, pvk) = params_guard.as_ref().unwrap();

    let circuit = MyCircuit {
        hospital_id: Some(zero),
        treatment: Some(zero),
        patient_id: Some(zero),
        leaf_index: Some(0),
        merkle_path: merkle_path.clone(),
        merkle_root: Some(merkle_root),
        preimage_commitment: Some(commitment),
    };

    let proof = match create_random_proof(circuit, params, &mut rand::thread_rng()) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(format!("Proof creation failed: {:?}", e))
        }
    };

    // 4. Verify proof using *circuit-calculated* root, comm
    let valid = verify_proof(&pvk, &proof, &[merkle_root, commitment]).unwrap_or(false);

    // 5. Return result
    HttpResponse::Ok().json(serde_json::json!({
        "public_inputs": [
            format!("0x{}", hex::encode(merkle_root.to_repr())),
            format!("0x{}", hex::encode(commitment.to_repr())),
        ],
        "verified": valid,
        "note": "If this is 'true', paramgen and circuit structure match.",
    }))
}

#[post("/debug-zero-proof-old")]
async fn debug_zero_proof_old() -> impl Responder {
    let params_guard = PARAMS.lock().unwrap();
    let (params, _) = params_guard.as_ref().unwrap();
    let proof = create_random_proof(
        MyCircuit {
            hospital_id: Some(Fr::from(0u64)),
            treatment: Some(Fr::from(0u64)),
            patient_id: Some(Fr::from(0u64)),
            leaf_index: Some(0),
            merkle_path: vec![Some(Fr::from(0u64)); MERKLE_PATH_LEN],
            merkle_root: Some(Fr::from(0u64)),
            preimage_commitment: Some(Fr::from(0u64)),
        },
        params,
        &mut OsRng,
    )
    .unwrap();
    let ok = verify_proof(
        &prepare_verifying_key(&params.vk),
        &proof,
        &[Fr::from(0u64), Fr::from(0u64)],
    );
    HttpResponse::Ok().json(format!("Verified = {:?}", ok))
}

#[post("/debug-verify-proof")]
async fn debug_verify_proof() -> impl Responder {
    println!("=== DEBUG VERIFY PROOF ===");
    
    // Wrap everything in a try-catch to prevent server crashes
    let result = std::panic::catch_unwind(|| {
        // Force parameter regeneration for testing
        let params_path = "zkp-params/groth16_params.bin";
        let hash_path = "zkp-params/params.circuit_hash";
        
        // Check if parameters exist
        if !Path::new(params_path).exists() || !Path::new(hash_path).exists() {
            return Err("Parameters not found, please run init_params first");
        }
        
        // Step 1: Create a sample witness with real values from our logs
        println!("1. Creating sample witness");
        let hospital_id = match std::panic::catch_unwind(|| string_to_fr("df670909-2073-426c-b3e2-3878b9b8caab")) {
            Ok(id) => id,
            Err(_) => return Err("Failed to convert hospital_id")
        };
        
        let treatment = match std::panic::catch_unwind(|| string_to_fr("Burn")) {
            Ok(t) => t,
            Err(_) => return Err("Failed to convert treatment")
        };
        
        let patient_id = match std::panic::catch_unwind(|| string_to_fr("123")) {
            Ok(pid) => pid,
            Err(_) => return Err("Failed to convert patient_id")
        };
        
        // Compute poseidon leaf (commitment)
        println!("2. Computing commitment hash");
        let commitment = match std::panic::catch_unwind(|| {
            let poseidon_constants = PoseidonConstants::<Fr, U3>::new();
            let mut poseidon = Poseidon::new(&poseidon_constants);
            poseidon.input(hospital_id).unwrap();
            poseidon.input(treatment).unwrap();
            poseidon.input(patient_id).unwrap();
            poseidon.hash()
        }) {
            Ok(c) => c,
            Err(_) => return Err("Failed to compute commitment")
        };
        
        println!("Commitment: 0x{}", hex::encode(commitment.to_repr()));
        
        // Create Merkle path from known values
        println!("3. Setting up Merkle path");
        let merkle_path_values = vec![
            "49be2d760e994231f2568ad2ad920007589842f0495e63b9a14b9e1aad443264",
            "373194f79041883e41b056dfa1b213c3d8698d2604d5c8ca6faf7233c514584f",
            "979b70f475e0c23f8d6b7c513268a72623c61956bd8e54a2d25a623d43622f2e",
        ];
        
        let mut path = Vec::new();
        for hex_str in &merkle_path_values {
            match hex::decode(hex_str) {
                Ok(bytes) => {
                    if bytes.len() != 32 {
                        return Err("Invalid path element length");
                    }
                    
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&bytes);
                    
                    // Use from_bytes_be since we're receiving big-endian representation
                    match Fr::from_bytes_be(&arr) {
                        s if bool::from(s.is_some()) => path.push(s.unwrap()),
                        _ => {
                            // Try reverse byte order as a fallback
                            let mut reversed = arr.clone();
                            reversed.reverse();
                            match Fr::from_bytes_be(&reversed) {
                                s if bool::from(s.is_some()) => {
                                    println!("Note: Using reversed bytes for: {}", hex_str);
                                    path.push(s.unwrap())
                                },
                                _ => return Err("Invalid Fr value from bytes")
                            }
                        }
                    }
                },
                Err(_) => return Err("Failed to decode hex string")
            }
        }
        
        // Expected merkle root
        println!("4. Setting up expected root");
        let root_hex = "3eeeeae9e5b17f1760306bcd77b2eb04c223ad9fbc3984a6ef34cce4e7bd3a6c";
        let root_bytes = match hex::decode(root_hex) {
            Ok(bytes) => bytes,
            Err(_) => return Err("Failed to decode root hex")
        };
        
        if root_bytes.len() != 32 {
            return Err("Invalid root length");
        }
        
        let mut root_arr = [0u8; 32];
        root_arr.copy_from_slice(&root_bytes);
        
        let expected_root = match Fr::from_bytes_be(&root_arr) {
            s if bool::from(s.is_some()) => s.unwrap(),
            _ => {
                // Try reverse byte order as a fallback
                let mut reversed = root_arr.clone();
                reversed.reverse();
                match Fr::from_bytes_be(&reversed) {
                    s if bool::from(s.is_some()) => {
                        println!("Note: Using reversed bytes for root");
                        s.unwrap()
                    },
                    _ => return Err("Invalid root Fr value")
                }
            }
        };
        
        println!("Expected root: 0x{}", hex::encode(expected_root.to_repr()));
        
        // Step 2: Create circuit instance
        println!("5. Creating circuit instance");
        let circuit = MyCircuit {
            hospital_id: Some(hospital_id),
            treatment: Some(treatment),
            patient_id: Some(patient_id),
            leaf_index: Some(1),
            merkle_path: path.iter().map(|&x| Some(x)).collect(),
            merkle_root: Some(expected_root),
            preimage_commitment: Some(commitment),
        };
        
        // Step 3: Load parameters
        println!("6. Loading parameters");
        let params_guard = PARAMS.lock().unwrap();
        if params_guard.is_none() {
            return Err("Parameters not initialized");
        }
        
        // Step 4: Generate proof
        println!("7. Generating proof");
        let (params, pvk) = params_guard.as_ref().unwrap();
        let proof = match std::panic::catch_unwind(|| create_random_proof(circuit, params, &mut OsRng)) {
            Ok(Ok(p)) => p,
            Ok(Err(_e)) => return Err("Proof generation failed"),
            Err(_) => return Err("Proof generation panicked")
        };
        
        // Step 5: Verify proof
        println!("8. Verifying proof");
        let pub_inputs = vec![expected_root, commitment];
        
        println!("Public inputs: [0x{}, 0x{}]", 
            hex::encode(pub_inputs[0].to_repr()),
            hex::encode(pub_inputs[1].to_repr())
        );
        
        // Verify proof
        let result = match verify_proof(pvk, &proof, &pub_inputs) {
            Ok(true) => {
                println!("✅ DEBUG verification succeeded!");
                Ok(json!({
                    "verified": true,
                    "message": "Proof verification succeeded",
                    "public_inputs": [
                        format!("0x{}", hex::encode(pub_inputs[0].to_repr())),
                        format!("0x{}", hex::encode(pub_inputs[1].to_repr()))
                    ]
                }))
            },
            Ok(false) => {
                println!("❌ DEBUG verification failed!");
                Ok(json!({
                    "verified": false,
                    "message": "Proof verification failed",
                    "public_inputs": [
                        format!("0x{}", hex::encode(pub_inputs[0].to_repr())),
                        format!("0x{}", hex::encode(pub_inputs[1].to_repr()))
                    ]
                }))
            },
            Err(e) => {
                println!("❌ DEBUG verification error: {:?}", e);
                Err("Verification error")
            }
        };
        
        result
    });
    
    match result {
        Ok(Ok(json)) => HttpResponse::Ok().json(json),
        Ok(Err(err)) => HttpResponse::InternalServerError().json(format!("Operation failed: {}", err)),
        Err(_) => HttpResponse::InternalServerError().json("Server panicked during debug process")
    }
}

#[post("/generate-proof")]
async fn generate_proof(input: web::Json<ProofRequest>) -> impl Responder {
    let hospital_id_fr = string_to_fr(&input.hospital_id);
    let treatment_fr = string_to_fr(&input.treatment);
    let patient_id_fr = string_to_fr(&input.patient_id);

    // Compute leaf commitment (Poseidon)
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon.input(hospital_id_fr).unwrap();
    poseidon.input(treatment_fr).unwrap();
    poseidon.input(patient_id_fr).unwrap();
    let commitment = poseidon.hash();

    // Parse Merkle path
    let mut actual_merkle_path = vec![];
    for (_i, hex_sibling) in input.merkle_path.iter().enumerate() {
        let bytes = hex::decode(hex_sibling.trim_start_matches("0x")).unwrap();
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        let fr = blstrs::Scalar::from_repr(arr).unwrap();
        actual_merkle_path.push(Some(fr));
    }
    if actual_merkle_path.len() != MERKLE_PATH_LEN {
        return HttpResponse::BadRequest().json(format!(
            "Merkle path must have {} elements",
            MERKLE_PATH_LEN
        ));
    }

    let merkle_root_bytes = hex::decode(input.merkle_root.trim_start_matches("0x")).unwrap();
    let mut root_arr = [0u8; 32]; root_arr.copy_from_slice(&merkle_root_bytes[..]);
    let actual_merkle_root = Fr::from_repr(root_arr).unwrap();

    // --- BEGIN CRUCIAL DIAGNOSTIC LOG ---
    println!();
    println!(">>>>>>>>>>> [GEN/PROOF] ZKP WITNESS SUMMARY <<<<<<<<<<");
    println!(" hospital_id   (input): {:?} -> 0x{}", input.hospital_id, hex::encode(hospital_id_fr.to_repr()));
    println!(" treatment     (input): {:?} -> 0x{}", input.treatment,   hex::encode(treatment_fr.to_repr()));
    println!(" patient_id    (input): {:?} -> 0x{}", input.patient_id,  hex::encode(patient_id_fr.to_repr()));
    println!(" [WIT] leaf_index      : {}", input.merkle_leaf_index);

    for (i, el) in actual_merkle_path.iter().enumerate() {
        println!(" [WIT] merkle_path[{}]  : 0x{}", i, el.unwrap().to_repr().iter().map(|b| format!("{:02x}",b)).collect::<String>());
    }
    println!(" [WIT] merkle_root      : 0x{}", hex::encode(actual_merkle_root.to_repr()));
    println!(" [WIT] commitment       : 0x{}", hex::encode(commitment.to_repr()));
    println!("---------- END WITNESS SUMMARY ----------");

    // Print public input field bytes for backend/frontend debug:
    let mut root_bytes = [0u8; 32]; root_bytes.copy_from_slice(&actual_merkle_root.to_repr());
    let mut comm_bytes = [0u8; 32]; comm_bytes.copy_from_slice(&commitment.to_repr());
    println!(" [PUB] Public input 0 (merkle_root):   0x{} [{:?}]", hex::encode(root_bytes), root_bytes);
    println!(" [PUB] Public input 1 (commitment) :   0x{} [{:?}]", hex::encode(comm_bytes), comm_bytes);

    //---- Optional: Off-circuit merkle root check, per round ----
    let mut debug_cur = commitment;
    for (i, sibling) in actual_merkle_path.iter().enumerate() {
        let bit = ((input.merkle_leaf_index >> i) & 1) == 1;
        let (left, right) = if bit {
            (sibling.unwrap(), debug_cur)
        } else {
            (debug_cur, sibling.unwrap())
        };
        let h = {
            let constants = PoseidonConstants::<Fr, U2>::new();
            let mut poseidon = Poseidon::new(&constants);
            poseidon.input(left).unwrap();
            poseidon.input(right).unwrap();
            poseidon.hash()
        };
        println!(
            "[OFFC] Merkle round {}: bit={} left=0x{} right=0x{} hash=0x{}",
            i, bit, hex::encode(left.to_repr()), hex::encode(right.to_repr()), hex::encode(h.to_repr())
        );
        debug_cur = h;
    }
    println!(
        "[OFFC] Final computed root: 0x{} (expected: 0x{})  MATCH={}",
        hex::encode(debug_cur.to_repr()),
        hex::encode(actual_merkle_root.to_repr()),
        debug_cur == actual_merkle_root
    );
    println!("<<<<<<<<<< [END PROOF DIAGNOSTIC] >>>>>>>>>>\n");

    // circuit witness construction
    let circuit = MyCircuit {
        hospital_id: Some(hospital_id_fr),
        treatment: Some(treatment_fr),
        patient_id: Some(patient_id_fr),
        leaf_index: Some(input.merkle_leaf_index),
        merkle_path: actual_merkle_path.clone(),
        merkle_root: Some(actual_merkle_root),
        preimage_commitment: Some(commitment),
    };

    // ZKP parameters
    let params_guard = PARAMS.lock().unwrap();
    if params_guard.is_none() {
        return HttpResponse::InternalServerError().json("Parameters not initialized");
    }
    let (params, pvk) = params_guard.as_ref().unwrap();

    // --- Create + serialize proof ---
    let proof = match create_random_proof(circuit, params, &mut OsRng) {
        Ok(p) => p,
        Err(e) => {
            println!("  [ERR] ZK Proof error: {:?}", e);
            return HttpResponse::InternalServerError().json("Proof generation failed");
        }
    };
    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();

    // --- Immediate self-verification ---
    let result = verify_proof(pvk, &proof, &[actual_merkle_root, commitment]);
    println!("[SELF-CHECK] Immediate verification result: {:?}", result);

    // --- Output for client ---
    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_inputs: vec![root_bytes.to_vec(), comm_bytes.to_vec()],
    })
}

#[post("/verify-proof")]
async fn verify_proof_endpoint(
    proof_data: web::Json<ProofResponse>,
) -> Result<HttpResponse, actix_web::Error> {
    println!("=== VERIFY PROOF (Groth16) ===");
    // Access parameters from PARAMS lazy_static
    let params_guard = PARAMS.lock().unwrap();
    // Check if params are loaded
    if params_guard.is_none() {
        println!("Error: Parameters not loaded during verification!");
        return Ok(HttpResponse::InternalServerError().json("Parameters not initialized"));
    }
    let (_, pvk) = params_guard.as_ref().unwrap();

    // Validate lengths
    if proof_data.public_inputs.len() != 2 {
        println!(
            "Error: Expected 2 public inputs, got {}",
            proof_data.public_inputs.len()
        );
        return Ok(HttpResponse::BadRequest().json("Expected 2 public inputs"));
    }
    
    // Parse inputs properly
    let mut public_inputs: Vec<Fr> = Vec::with_capacity(2);
    
    // Parse each public input from raw bytes using from_repr (Little Endian)
    for (i, inp) in proof_data.public_inputs.iter().enumerate() {
        if inp.len() != 32 {
            println!(
                "Error: Public input[{}] is not 32 bytes, got {}",
                i,
                inp.len()
            );
            return Ok(
                HttpResponse::BadRequest().json(format!("Public input {} must be 32 bytes", i))
            );
        }

        println!("Attempting to parse public_input[{}]: 0x{}", i, hex::encode(inp));

        // Copy bytes into a 32-byte array
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&inp);
        
        // Use from_repr directly (assumes Little Endian from bellperson's to_repr)
        let fr_opt = Fr::from_repr(bytes);
        if fr_opt.is_some().into() {
            let fr = fr_opt.unwrap();
            println!("Public input[{}] parsed with from_repr: 0x{}", i, hex::encode(fr.to_repr()));
            public_inputs.push(fr);
        } else {
             println!("Error: Invalid field element representation for public input {}: 0x{}", i, hex::encode(bytes));
             // Optionally, try from_bytes_be as a fallback if endianness is uncertain
             let fr_be_opt = Fr::from_bytes_be(&bytes);
             if fr_be_opt.is_some().into() {
                 let fr = fr_be_opt.unwrap();
                 println!("WARN: Public input[{}] parsed with from_bytes_be (Big Endian fallback): 0x{}", i, hex::encode(fr.to_repr()));
                 public_inputs.push(fr);
             } else {
                println!("Error: Failed to parse public input {} using both from_repr and from_bytes_be.", i);
                return Ok(HttpResponse::BadRequest().json(format!("Invalid field element format for public input {}", i)));
             }
        }
    }

    // Parse the proof
    let proof = match Proof::<Bls12>::read(&mut std::io::Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Error: Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };

    // Perform verification with correctly parsed inputs
    println!("Verifying proof with {} public inputs", public_inputs.len());
    for (i, input) in public_inputs.iter().enumerate() {
        println!("Public input[{}]: 0x{}", i, hex::encode(input.to_repr()));
    }
    
    let verification_result = verify_proof(&pvk, &proof, &public_inputs);

    match verification_result {
        Ok(true) => {
            println!("✔️  Proof verified successfully.");
            Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
        }
        Ok(false) => {
            println!("❌ Proof verification failed.");
            // Include parsed public inputs in the response for debugging
            let parsed_inputs_hex: Vec<String> = public_inputs.iter().map(|fr| format!("0x{}", hex::encode(fr.to_repr()))).collect();
            Ok(HttpResponse::Ok().json(json!({
                "valid": false, 
                "message": "Proof is invalid",
                "parsed_public_inputs": parsed_inputs_hex
            })))
        }
        Err(e) => {
            println!("❌ Proof verification error: {:?}", e);
            Ok(HttpResponse::InternalServerError().json(format!("Proof verification error: {:?}", e)))
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
    // For 3 inputs: strings or 0x field elements
    let mut frs = vec![];
    for s in &req.inputs {
        if s.starts_with("0x") {
            let val = hex::decode(&s[2..]).unwrap();
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&val);
            frs.push(Fr::from_repr(arr).unwrap());
        } else {
            frs.push(string_to_fr(s));
        }
    }
    let hash = match frs.len() {
        2 => {
            let constants = PoseidonConstants::<Fr, U2>::new();
            let mut p = Poseidon::new(&constants);
            p.input(frs[0]).unwrap();
            p.input(frs[1]).unwrap();
            p.hash()
        }
        3 => {
            let constants = PoseidonConstants::<Fr, U3>::new();
            let mut p = Poseidon::new(&constants);
            p.input(frs[0]).unwrap();
            p.input(frs[1]).unwrap();
            p.input(frs[2]).unwrap();
            p.hash()
        }
        _ => {
            return HttpResponse::BadRequest().body("must be arity 2 or 3");
        }
    };
    HttpResponse::Ok().json(PoseidonHashResponse {
        hash: format!("0x{}", hex::encode(hash.to_repr())),
    })
}

/// ... Your ZKP endpoints, parameters, ZKP circuit omitted for brevity ...
/// Use string_to_fr for all string value encoding
/// On proof gen and verify, accept ALL public inputs as 32B BE arrays (no flips or reverse!)

#[post("/string-to-fr")]
async fn string_to_fr_endpoint(body: String) -> impl Responder {
    let fr = string_to_fr(&body);
    HttpResponse::Ok().json(format!("0x{}", hex::encode(fr.to_repr())))
}

#[post("/test-poseidon")]
async fn test_poseidon(req: web::Json<PoseidonHashRequest>) -> impl Responder {
    let mut frs = vec![];
    for s in &req.inputs {
        if s.starts_with("0x") {
            let val = hex::decode(&s[2..]).unwrap();
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&val);
            frs.push(Fr::from_repr(arr).unwrap());
        } else {
            frs.push(string_to_fr(s));
        }
    }
    let hash = match frs.len() {
        2 => {
            let c = PoseidonConstants::<Fr, U2>::new();
            let mut p = Poseidon::new(&c);
            p.input(frs[0]).unwrap();
            p.input(frs[1]).unwrap();
            p.hash()
        }
        3 => {
            let c = PoseidonConstants::<Fr, U3>::new();
            let mut p = Poseidon::new(&c);
            p.input(frs[0]).unwrap();
            p.input(frs[1]).unwrap();
            p.input(frs[2]).unwrap();
            p.hash()
        }
        _ => return HttpResponse::BadRequest().body("need 2 or 3 inputs"),
    };
    HttpResponse::Ok().body(format!("0x{}", hex::encode(hash.to_repr())))
}

#[derive(Debug, Deserialize)]
pub struct MerkleCheckRequest {
    leaf: String,      // "0x..." 32B hex
    path: Vec<String>, // ["0x...", ...]
    index: u64,
    root: String, // "0x..." 32B hex
}

#[derive(Debug, Serialize)]
pub struct MerkleCheckVerboseResponse {
    // Print every step
    input_leaf: String,
    index_bits: Vec<u8>,
    per_round: Vec<RoundLog>,
    reconstructed_root: String,
    expected_root: String,
    root_match: bool,
}

#[derive(Debug, Serialize)]
pub struct RoundLog {
    round: usize,
    sibling: String,
    bit: u8,
    left: String,
    right: String,
    output: String,
}

#[post("/merkle-root-check-verbose")]
async fn merkle_root_check_verbose(info: web::Json<MerkleCheckRequest>) -> impl Responder {
    use blstrs::Scalar as Fr;
    use neptune::poseidon::{Poseidon, PoseidonConstants};
    use typenum::U2;
    // Parse leaf & root
    let get_fr = |hx: &str| {
        let mut a = [0u8; 32];
        a.copy_from_slice(&hex::decode(hx.strip_prefix("0x").unwrap_or(hx)).unwrap());
        Fr::from_repr(a).expect("Invalid Fr")
    };
    let mut cur = get_fr(&info.leaf);
    let expected_root = get_fr(&info.root);
    let mut round_logs = vec![];
    let mut index_bits = vec![];
    let index = info.index;
    println!("[RUST-MERKLE] --- BEGIN MERKLE PATH RECOMPUTATION ---");
    println!(
        "[RUST-MERKLE] initial_leaf = 0x{}",
        hex::encode(cur.to_repr())
    );
    for i in 0..info.path.len() {
        let sibling = get_fr(&info.path[i]);
        let bit = ((index >> i) & 1) as u8;
        index_bits.push(bit);
        let (left, right) = if bit == 1 {
            (sibling, cur)
        } else {
            (cur, sibling)
        };
        let constants = PoseidonConstants::<Fr, U2>::new();
        let mut poseidon = Poseidon::new(&constants);
        poseidon.input(left).unwrap();
        poseidon.input(right).unwrap();
        let out = poseidon.hash();
        println!(
            "[RUST-MERKLE] level={} bit={} left=0x{} right=0x{} hash=0x{}",
            i,
            bit,
            hex::encode(left.to_repr()),
            hex::encode(right.to_repr()),
            hex::encode(out.to_repr()),
        );
        round_logs.push(RoundLog {
            round: i,
            sibling: format!("0x{}", hex::encode(sibling.to_repr())),
            bit,
            left: format!("0x{}", hex::encode(left.to_repr())),
            right: format!("0x{}", hex::encode(right.to_repr())),
            output: format!("0x{}", hex::encode(out.to_repr())),
        });
        cur = out;
    }
    println!(
        "[RUST-MERKLE] final_root 0x{}  (expected 0x{})  MATCH={}",
        hex::encode(cur.to_repr()),
        hex::encode(expected_root.to_repr()),
        cur == expected_root
    );
    println!("[RUST-MERKLE] --- END MERKLE PATH RECOMPUTATION ---");
    HttpResponse::Ok().json(MerkleCheckVerboseResponse {
        input_leaf: info.leaf.clone(),
        index_bits,
        per_round: round_logs,
        reconstructed_root: format!("0x{}", hex::encode(cur.to_repr())),
        expected_root: info.root.clone(),
        root_match: cur == expected_root,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    poseidon_diag_vector();
    init_params();
    HttpServer::new(|| {
        App::new()
            .service(generate_proof)
            .service(verify_proof_endpoint)
            .service(poseidon_hash_endpoint)
            .service(string_to_fr_endpoint)
            .service(merkle_root_check_verbose)
            .service(debug_zero_proof)
            .service(debug_zero_proof_old)
            .service(debug_verify_proof)
            .service(test_poseidon)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
