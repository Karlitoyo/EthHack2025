// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ZKProofLog {
    event ProofSubmitted(
        address indexed submitter,
        bytes proof,             // or bytes32[], or split into parts if groth16
        uint256[] publicInputs,
        uint256 timestamp
    );

    function submitProof(bytes calldata proof, uint256[] calldata publicInputs) external {
        emit ProofSubmitted(msg.sender, proof, publicInputs, block.timestamp);
    }
}