// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ZKProofLog {
    /// @notice Emitted when a new ZK proof is submitted
    /// @param submitter The address submitting
    /// @param merkleRoot The Merkle tree root (public input)
    /// @param preimageCommitment The poseidon(hospital, treatment, patient) (public input)
    /// @param proof The raw proof data bytes (opaque)
    /// @param timestamp Block timestamp when submitted
    event ProofSubmitted(
        address indexed submitter,
        uint256 indexed merkleRoot,
        uint256 indexed preimageCommitment,
        bytes proof,
        uint256 timestamp
    );

    /// @notice Submit a proof + public inputs to be logged as an event
    /// @param proof Raw proof bytes (from ZKP system)
    /// @param merkleRoot Merkle root public input
    /// @param preimageCommitment Preimage commitment public input
    function submitProof(
        bytes calldata proof,
        uint256 merkleRoot,
        uint256 preimageCommitment
    ) external {
        emit ProofSubmitted(
            msg.sender,
            merkleRoot,
            preimageCommitment,
            proof,
            block.timestamp
        );
    }
}