import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

// Define the type for the modal content
interface ModalContent {
  title: string;
  body: string;
}

export default function GenerateProof() {
  const [identifier, setIdentifier] = useState(''); // Changed from ancestorId, relationshipType, descendantId

  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState('');

  // State for controlling the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  // Loading states
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  async function submitHandler(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setProof(null);
    setIsModalOpen(false);
    setModalContent(null);
    setIsGeneratingProof(true); // Start loading

    try {
      // Payload now uses a single identifier
      const payload = {
        identifier: identifier,
      };

      // Basic validation for the required field
      if (!payload.identifier) {
        throw new Error('Identifier is required.');
      }

      // 1. Generate proof by calling the new lineage proof endpoint
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/zk-snark/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // Send the identifier
      });
      if (!res.ok) throw new Error(await res.text());
      const proofJson = await res.json();
      setProof(proofJson);

    } catch (err) {
      setError(String(err));
      setModalContent({ title: "Proof Generation Error", body: String(err) });
      setIsModalOpen(true);
    } finally {
      setIsGeneratingProof(false); // Stop loading
    }
  }

  // Function to handle closing the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  // Function to handle submitting the proof
  const handleSubmitProof = async () => {
    setError('');
    setIsModalOpen(false);
    setModalContent(null);
    setIsSubmittingProof(true);

    try {
      const submitRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ethereum/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proof.proof,
          public_inputs: proof.public_inputs
        })
      });

      if (!submitRes.ok) {
        // Throw error to be caught below
        throw new Error(`Submission failed: ${await submitRes.text()}`);
      }

      const submitResult = await submitRes.json();

      // Set modal content for success and open modal
      setModalContent({
        title: "Proof Submitted Successfully",
        body: `Proof logged on chain!\nTx hash: ${submitResult.transactionHash}\nSee on Etherscan: ${submitResult.etherscanUrl || 'N/A'}`
      });
      setIsModalOpen(true);

    } catch (err: any) {
      const errorMessage = err.message || String(err);
      // Set form-level error state
      setError(errorMessage);
      // Set modal content for error and open modal
      setModalContent({ title: "Submission Error", body: errorMessage });
      setIsModalOpen(true);
    } finally {
      setIsSubmittingProof(false); // Stop submitting loading
    }
  };


  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Toaster position="top-center" reverseOrder={false} />
      <h2 className="text-2xl font-bold mb-6">Generate ZK Proof for Lineage Link</h2>
      <form onSubmit={submitHandler} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
            Identifier (Citizen ID or Family ID)
          </label>
          <input
            type="text"
            name="identifier"
            id="identifier"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter Citizen ID or Family ID"
          />
        </div>
        
        <button
          type="submit"
          disabled={isGeneratingProof || isSubmittingProof}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isGeneratingProof ? 'Generating Proof...' : 'Generate Proof'}
        </button>
      </form>

      {proof && !error && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="text-lg font-medium text-green-800">Proof Generated Successfully!</h3>
          <pre className="mt-2 text-sm text-green-700 overflow-x-auto">{JSON.stringify(proof, null, 2)}</pre>
          <button
            onClick={handleSubmitProof}
            disabled={isSubmittingProof || !proof}
            className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmittingProof ? 'Submitting Proof...' : 'Submit Proof to Chain'}
          </button>
        </div>
      )}

      {/* DaisyUI Modal */}
      {isModalOpen && modalContent && (
        <dialog id="submission_modal" className="modal modal-open">
          <div className="modal-box modal-lg max-w-4xl">
            <h3 className="font-bold text-lg">{modalContent.title}</h3>
            {(() => {
              const body = modalContent.body;
              const linkPrefix = "See on Etherscan: ";
              const linkIndex = body.lastIndexOf(linkPrefix);

              if (linkIndex !== -1) {
              const textBeforeLink = body.substring(0, linkIndex);
              const url = body.substring(linkIndex + linkPrefix.length);

              // Check if the extracted URL is valid and not 'N/A'
              if (url && url !== 'N/A' && (url.startsWith('http://') || url.startsWith('https://'))) {
                return (
                <div className="py-4">
                  <p className="whitespace-pre-wrap">{textBeforeLink}</p>
                  <p className="whitespace-pre-wrap">
                  {linkPrefix}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="link link-primary break-all">
                    {url}
                  </a>
                  </p>
                </div>
                );
              }
              }
              // Fallback: Render the original body if no valid link is found
              return <p className="py-4 text-base whitespace-pre-wrap">{body}</p>;
            })()}
            <div className="modal-action">
              <button className="btn" onClick={closeModal}>Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
