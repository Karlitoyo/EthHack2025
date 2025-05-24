import React, { useState } from 'react';
import { LineageData } from '../../interfaces'; // Import the updated interfaces

export default function FamilySearch() {
    const [citizenId, setCitizenId] = useState('');
    const [data, setData] = useState<LineageData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const errorModalRef = React.useRef<HTMLDialogElement>(null); // Declare the ref

    const fetchFamilyData = async () => {
        if (!citizenId.trim()) {
            setError('Please enter a Citizen ID.');
            setData(null); // Clear previous data if any
            return;
        }

        setLoading(true);
        setError(null); // Clear any previous error (validation or backend)
        setData(null);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/relation/lineage/${citizenId}`);

            if (!res.ok) {
                let errorPayloadMessage = `Error: ${res.status} ${res.statusText || 'Server Error'}`;
                try {
                    const errorData = await res.json();
                    if (errorData && errorData.message) {
                        errorPayloadMessage = errorData.message;
                    }
                } catch (jsonError) {
                    console.warn('Could not parse error response as JSON.', jsonError);
                }
                throw new Error(errorPayloadMessage);
            }

            const json: LineageData = await res.json();
            setData(json);

        } catch (err: any) {
            console.error('Error fetching data:', err);
            
            const errorMessage = (err instanceof Error && err.message) 
                               ? err.message 
                               : 'Failed to fetch family data. An unexpected error occurred.';
            setError(errorMessage);

            if (errorModalRef.current) {
                errorModalRef.current.showModal();
            } else {
                console.warn("Error modal ref is not available. Ensure 'errorModalRef' is defined and passed to a <dialog> element.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            {/* Error Modal Dialog */}
            <dialog id="error_modal" className="modal" ref={errorModalRef}>
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-error">Error!</h3>
                    <p className="py-4">{error}</p>
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            <div className="card w-full max-w-7xl bg-base-100 shadow-xl mx-auto">
            <div className="card-body p-6 sm:p-8">
                <h2 className="card-title text-2xl md:text-3xl mb-6 text-center sm:text-left">
                Search Citizen Lineage by ID
                </h2>

                <div className="form-control w-full mb-6">
                <label className="label sr-only" htmlFor="citizenIdInput">Citizen ID</label>
                <div className="input-group input-group-lg">
                    <input
                    id="citizenIdInput"
                    type="text"
                    placeholder="Enter Citizen ID (e.g., CZN001)"
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    className="input input-bordered w-full input-lg"
                    aria-label="Citizen ID Input"
                    />
                    <button
                    onClick={fetchFamilyData}
                    disabled={!citizenId.trim() || loading}
                    className="btn btn-primary btn-lg mt-10"
                    >
                    {loading ? <span className="loading loading-spinner"></span> : 'Search Lineage'}
                    </button>
                </div>
                </div>

                {error && (
                <div role="alert" className="alert alert-error my-6 animate-fadeIn">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                </div>
                )}

                {data && (
                <div className="mt-6 bg-base-200 shadow-xl rounded-lg p-4 sm:p-6">
                    <h2 className="text-2xl font-bold mb-4 text-center text-primary">Lineage Information</h2>
                    
                    {/* Target Relation Details */}
                    <div className="mb-6 pb-4 border-b border-base-300">
                        <h3 className="text-xl font-semibold mb-2 text-accent">Target Individual</h3>
                        <p><span className="font-medium">Name:</span> {data.targetRelation.firstName} {data.targetRelation.lastName}</p>
                        <p><span className="font-medium">ID:</span> {data.targetRelation.id}</p>
                    </div>

                    {/* Lineage Path (Ancestors) */}
                    {data.lineagePath && data.lineagePath.length > 0 && (
                        <div className="mb-6 pb-4 border-b border-base-300">
                            <h3 className="text-xl font-semibold mb-2 text-accent">Ancestral Lineage</h3>
                            <ul className="list-disc list-inside pl-4">
                                {data.lineagePath.map((ancestor, index) => (
                                    <li key={ancestor.id} className="mb-1">
                                        {ancestor.name} {ancestor.roleInFamily ? `(${ancestor.roleInFamily})` : ''} (Family ID: {ancestor.familyId || 'N/A'})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Siblings Details */}
                    {data.siblings && data.siblings.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xl font-semibold mb-2 text-accent">Siblings</h3>
                            <ul className="list-disc list-inside pl-4">
                                {data.siblings.map(sibling => (
                                    <li key={sibling.id} className="mb-1">
                                        {sibling.firstName} {sibling.lastName} (ID: {sibling.id})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!data.lineagePath?.length && !data.siblings?.length && (
                        <p className="text-center text-info">No lineage or sibling information available for this individual.</p>
                    )}
                </div>
                )}

                {!loading && !data && !error && (
                <div className="text-center py-10 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-base-content opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.242-4.242 3 3 0 00-4.242 4.242zM10 17h4" />
                    </svg>
                    <p className="mt-2 text-xl text-base-content opacity-70">Enter a Citizen ID to search.</p>
                    <p className="text-sm text-base-content opacity-50">Family lineage and sibling information will be displayed here.</p>
                </div>
                )}
            </div>
            </div>
        </div>
    );
}
