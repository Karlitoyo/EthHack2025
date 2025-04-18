use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use bellperson::gadgets::num::AllocatedNum;
use bellperson::groth16::{
    create_random_proof, generate_random_parameters, prepare_verifying_key, verify_proof, Proof,
};
use bellperson::{Circuit, ConstraintSystem, SynthesisError};
use blstrs::Scalar as Fr; // Use Fr from blstrs instead of bellperson
use blstrs::Bls12;  
use lazy_static::lazy_static;
use neptune::poseidon::PoseidonConstants;
use neptune::circuit::poseidon_hash;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Cursor;
use std::sync::Mutex;
use ff::PrimeField; // Add this import for to_repr()

// Hash to field helper (SHA256)
#[allow(dead_code)]
fn hash_to_fr(fields: &[&str]) -> Fr {
    use sha2::{Digest, Sha256};
    
    let mut hasher = Sha256::new();
    for field in fields {
        hasher.update(field.as_bytes());
    }
    let hash: sha2::digest::generic_array::GenericArray<u8, typenum::UInt<typenum::UInt<typenum::UInt<typenum::UInt<typenum::UInt<typenum::UInt<typenum::UTerm, typenum::B1>, typenum::B0>, typenum::B0>, typenum::B0>, typenum::B0>, typenum::B0>> = hasher.finalize();
    
    // Convert hash to Fr using from_bytes
    let mut bytes: [u8; 32] = [0u8; 32];
    bytes.copy_from_slice(hash.as_slice());
    
    // Use the direct Fr methods rather than trait methods
    let result = Fr::from_bytes_be(&bytes);
    
    // Manual unwrap with is_some() and unwrap()
    if bool::from(result.is_some()) {
        result.unwrap()
    } else {
        // Use a direct zero value instead of the Field trait
        Fr::from(0u64) // Create zero scalar directly
    }
}

#[derive(Deserialize)]
pub struct ProofRequest {
    pub hospital_id: String,
    pub treatment: String,
    pub patient_id: String,
}

#[derive(Clone)]
pub struct MyCircuit {
    // private inputs
    pub hospital_id: Option<Fr>,
    pub treatment: Option<Fr>,
    pub patient_id: Option<Fr>,
    // public input (the commitment)
    pub commitment: Option<Fr>,
}

impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(
        self,
        cs: &mut CS
    ) -> Result<(), SynthesisError> {
        let hospital_id: AllocatedNum<Fr> = AllocatedNum::alloc(&mut *cs, || self.hospital_id.ok_or(SynthesisError::AssignmentMissing))?;
        let treatment: AllocatedNum<Fr> = AllocatedNum::alloc(&mut *cs, || self.treatment.ok_or(SynthesisError::AssignmentMissing))?; // Fixed consistent borrowing
        let patient_id: AllocatedNum<Fr> = AllocatedNum::alloc(&mut *cs, || self.patient_id.ok_or(SynthesisError::AssignmentMissing))?;
        let commitment_var: bellperson::Variable = cs.alloc_input(
            || "commitment", 
            || self.commitment.ok_or(SynthesisError::AssignmentMissing)
        )?;

        use typenum::U3;
        let params: PoseidonConstants<Fr, U3> = PoseidonConstants::new();
        let preimages: Vec<AllocatedNum<Fr>> = vec![hospital_id.clone(), treatment.clone(), patient_id.clone()];

        // Pass a mutable reference to cs instead of cs itself
        let hash: AllocatedNum<Fr> = poseidon_hash(&mut *cs, preimages, &params)?;
        
        // Now cs is still available for use
        cs.enforce(
            || "commitment is poseidon hash",
            |lc: bellperson::LinearCombination<_>| lc + hash.get_variable(),
            |lc: bellperson::LinearCombination<_>| lc + CS::one(),
            |lc: bellperson::LinearCombination<_>| lc + commitment_var, // Use the variable directly
        );
        
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
pub struct ProofResponse {
    proof: Vec<u8>,
    public_input: Vec<u8>,
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
    // --- CONVERT ALL TO blstrs::Scalar (Fr) ---
    let to_fr = |x: &String| hash_to_fr(&[&x]);
    let hospital_id_fr: Fr = to_fr(&input.hospital_id);
    let treatment_fr: Fr = to_fr(&input.treatment);
    let patient_id_fr: Fr = to_fr(&input.patient_id);

    // For prototype: commitment = hospital_id + treatment + patient_id (as Scalar)
    let commitment = hospital_id_fr + treatment_fr + patient_id_fr;

    // Set up params only once for this circuit shape
    let mut params_lock: std::sync::MutexGuard<'_, Option<(bellperson::groth16::Parameters<Bls12>, bellperson::groth16::PreparedVerifyingKey<Bls12>)>> = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        let params: bellperson::groth16::Parameters<Bls12> = generate_random_parameters::<Bls12, _, _>(
            MyCircuit {
                hospital_id: Some(hospital_id_fr),
                treatment: Some(treatment_fr),
                patient_id: Some(patient_id_fr),
                commitment: Some(commitment),
            },
            &mut OsRng,
        )
        .expect("parameter generation failed");
        let pvk: bellperson::groth16::PreparedVerifyingKey<Bls12> = prepare_verifying_key(&params.vk);
        *params_lock = Some((params, pvk));
    }
    let (params, _) = params_lock.as_ref().unwrap();
    let proof: Proof<Bls12> = create_random_proof(
        MyCircuit {
            hospital_id: Some(hospital_id_fr),
            treatment: Some(treatment_fr),
            patient_id: Some(patient_id_fr),
            commitment: Some(commitment),
        },
        params,
        &mut OsRng,
    )
    .expect("proof generation failed");

    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();

    let mut public_input_bytes: [u8; 32] = [0u8; 32];
    public_input_bytes.copy_from_slice(&commitment.to_repr()); // blstrs::Scalar::to_repr() -> [u8;32]

    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_input: public_input_bytes.to_vec(),
    })
}

#[post("/verify-proof")]
async fn verify_proof_endpoint(
    proof_data: web::Json<ProofResponse>,
) -> Result<HttpResponse, actix_web::Error> {
    // Parse the proof
    let proof: Proof<Bls12> = match Proof::<Bls12>::read(&mut Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };

    // Handle the public input: must be a multiple of 32, and not empty
    if proof_data.public_input.len() != 32 {
        println!("Public input not 32 bytes: {:?}", proof_data.public_input);
        return Ok(HttpResponse::BadRequest().json("Invalid public input length, expected 32"));
    }

    let mut public_input: Vec<Fr> = Vec::new();
    let mut buf = [0u8; 32];
    buf.copy_from_slice(&proof_data.public_input[0..32]);
    match Fr::from_bytes_be(&buf).into() {
        Some(fr) => public_input.push(fr),
        None => {
            println!("Invalid Fr bytes: {:?}", buf);
            return Ok(HttpResponse::BadRequest().json("Invalid Fr bytes"));
        }
    }

    let params_lock: std::sync::MutexGuard<'_, Option<(bellperson::groth16::Parameters<Bls12>, bellperson::groth16::PreparedVerifyingKey<Bls12>)>> = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        return Ok(HttpResponse::InternalServerError().json("Parameters not initialized"));
    }
    let (_, pvk) = params_lock.as_ref().unwrap();
    let is_valid: bool = verify_proof(&pvk, &proof, &public_input).is_ok();
    if is_valid {
        Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
    } else {
        Ok(HttpResponse::Ok().json(json!({"valid": false, "message": "Proof is invalid"})))
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("🚀 Starting Zero-Knowledge Proof service on http://localhost:8080");
    HttpServer::new(|| {
        App::new()
            .service(generate_proof)
            .service(verify_proof_endpoint)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}