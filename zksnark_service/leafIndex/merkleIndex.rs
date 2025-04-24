use blstrs::Scalar as Fr;
use neptune::poseidon::{Poseidon, PoseidonConstants};
use typenum::U3;
use hex;
use sha2::{Digest, Sha256};

const TREE_HEIGHT: usize = 3; // matches your circuit
const TREE_LEAVES: usize = 1 << TREE_HEIGHT;

fn string_to_fr(s: &str) -> Fr {
    let hash = Sha256::digest(s.as_bytes());
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&hash[..32]);
    Fr::from_bytes(&arr).unwrap()
}

fn poseidon_leaf(hospital_id: &str, treatment: &str, patient_id: &str) -> Fr {
    let hospital_fr = string_to_fr(hospital_id);
    let treatment_fr = string_to_fr(treatment);
    let patient_fr = string_to_fr(patient_id);
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon.input(hospital_fr).unwrap();
    poseidon.input(treatment_fr).unwrap();
    poseidon.input(patient_fr).unwrap();
    poseidon.hash()
}

fn merkle_tree(leaves: &[Fr]) -> (Vec<Vec<Fr>>, Fr) {
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut levels: Vec<Vec<Fr>> = vec![leaves.to_vec()];
    // Build tree bottom-up
    for level in 0..TREE_HEIGHT {
        let prev = levels.last().unwrap();
        let mut next = vec![];
        for i in (0..prev.len()).step_by(2) {
            let left = prev[i];
            let right = prev[i+1];
            // Order: left, right
            let mut poseidon = Poseidon::new(&constants);
            poseidon.input(left).unwrap();
            poseidon.input(right).unwrap();
            next.push(poseidon.hash());
        }
        levels.push(next);
    }
    let root = levels.last().unwrap()[0];
    (levels, root)
}

fn get_merkle_path(levels: &Vec<Vec<Fr>>, leaf_idx: usize) -> Vec<Fr> {
    // Siblings, bottom-up (circuit expects this order - confirm!)
    let mut idx = leaf_idx;
    let mut path = vec![];
    for l in 0..TREE_HEIGHT {
        let sib = if idx % 2 == 0 { idx+1 } else { idx-1 };
        path.push(levels[l][sib]);
        idx /= 2;
    }
    path
}

fn main() {
    // Example: build tree with 8 leaves
    let hospital_id = "df670909-2073-426c-b3e2-3878b9b8caab";
    let treatment = "Burn";
    let patient_id = "123";
    let idx = 1; // The index you want the proof for (corresponds to 'merkle_leaf_index')

    // Build leaves: For demo, fill rest with dummy commitment, but YOUR leaf at idx!
    let mut leaves = vec![];
    for i in 0..TREE_LEAVES {
        if i == idx {
            leaves.push(poseidon_leaf(hospital_id, treatment, patient_id));
        } else {
            leaves.push(poseidon_leaf("dummy", "dummy", &format!("{}", i)));
        }
    }

    // Build tree
    let (levels, root) = merkle_tree(&leaves);

    // Get PATH (siblings)
    let path = get_merkle_path(&levels, idx);

    // Print results as hex (32 bytes per Fr)
    println!("Proving leaf index: {}\n", idx);
    let own_commitment = &leaves[idx];

    println!("Leaf/commitment: {}", hex::encode(own_commitment.to_repr()));
    println!("Merkle root:     {}", hex::encode(root.to_repr()));
    println!("Merkle path (hex):");
    for (i, sibling) in path.iter().enumerate() {
        println!("  [{}] {}", i, hex::encode(sibling.to_repr()));
    }
}