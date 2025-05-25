// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ZKProofLog {
    /// @notice Structure to store essential details of a proof submission on-chain.
    struct ProofRecord {
        uint256 id;
        address submitter;
        uint256 merkleRoot;
        uint256 preimageCommitment;
        bytes32 proofHash; // Hash of the raw proof data to save storage cost
        uint256 timestamp;
    }

    /// @notice Emitted when a new ZK proof is submitted
    /// @param proofId The unique ID of the stored proof record
    /// @param submitter The address submitting
    /// @param merkleRoot The Merkle tree root (public input)
    /// @param preimageCommitment The poseidon(hospital, treatment, patient) (public input)
    /// @param proof The raw proof data bytes (opaque) - available in event for off-chain systems
    /// @param timestamp Block timestamp when submitted
    event ProofSubmitted(
        uint256 indexed proofId,
        address indexed submitter,
        uint256 indexed merkleRoot,
        uint256 preimageCommitment,
        bytes proof, // Full proof bytes still in event
        uint256 timestamp
    );

    ProofRecord[] public proofRecords;
    uint256 public nextProofId;

    mapping(uint256 => ProofRecord) private _proofRecordById;
    mapping(bytes32 => bool) public isProofHashSubmitted; // To check for duplicate proof submissions by hash

    /// @notice Submit a proof + public inputs to be logged and stored
    /// @param proofData Raw proof bytes (from ZKP system)
    /// @param merkleRoot Merkle root public input
    /// @param preimageCommitment Preimage commitment public input
    function submitProof(
        bytes calldata proofData,
        uint256 merkleRoot,
        uint256 preimageCommitment
    ) external {
        bytes32 proofHash = keccak256(proofData);
        require(!isProofHashSubmitted[proofHash], "Proof already submitted");

        uint256 currentProofId = nextProofId;
        ProofRecord memory newRecord = ProofRecord({
            id: currentProofId,
            submitter: msg.sender,
            merkleRoot: merkleRoot,
            preimageCommitment: preimageCommitment,
            proofHash: proofHash,
            timestamp: block.timestamp
        });

        proofRecords.push(newRecord);
        _proofRecordById[currentProofId] = newRecord;
        isProofHashSubmitted[proofHash] = true;
        nextProofId++;

        emit ProofSubmitted(
            currentProofId,
            msg.sender,
            merkleRoot,
            preimageCommitment,
            proofData,
            block.timestamp
        );
    }

    /// @notice Get the total number of proofs submitted.
    /// @return The total count of proof records.
    function getProofRecordsCount() external view returns (uint256) {
        return proofRecords.length;
    }

    /// @notice Get a specific proof record by its ID.
    /// @param proofId The ID of the proof record to retrieve.
    /// @return The ProofRecord struct.
    function getProofRecordById(uint256 proofId) external view returns (ProofRecord memory) {
        require(proofId < nextProofId, "Proof ID out of bounds");
        return _proofRecordById[proofId];
    }

    /// @notice Get all proof records submitted by a specific address.
    /// @param submitterAddress The address of the submitter.
    /// @return An array of ProofRecord structs.
    function getProofRecordsBySubmitter(address submitterAddress) external view returns (ProofRecord[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < proofRecords.length; i++) {
            if (proofRecords[i].submitter == submitterAddress) {
                count++;
            }
        }

        ProofRecord[] memory result = new ProofRecord[](count);
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < proofRecords.length; i++) {
            if (proofRecords[i].submitter == submitterAddress) {
                result[resultIndex] = proofRecords[i];
                resultIndex++;
            }
        }
        return result;
    }
}