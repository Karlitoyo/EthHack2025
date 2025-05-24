import React, { useState } from 'react';

// Define interfaces for the expected data structure
interface CitizenDetail {
    id: string;
    citizenId: string | null;
    firstName: string;
    lastName: string;
    age: string;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
    relationshipToParentCountry?: string | null; // e.g., "son", "daughter"
    isTarget?: boolean; // For the initially searched citizen
}

interface CountryDetail {
    id: string;
    countryId: string | null;
    name: string;
    location: string;
    roleInFamily?: string | null; // e.g., "father", "grandfather"
}

interface LineageData {
    targetCitizen: CitizenDetail;
    lineage: CountryDetail[];
    siblings: CitizenDetail[];
}

export default function FamilySearch() { // Renamed component for clarity
    const [citizenId, setCitizenId] = useState('');
    const [data, setData] = useState<LineageData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFamilyData = async () => {
        if (!citizenId.trim()) {
            setError('Please enter a Citizen ID.');
            return;
        }
        setLoading(true);
        setError(null);
        setData(null);
        try {
            // Updated endpoint to match the backend controller
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/citizens/lineage/${citizenId}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Error: ${res.status}`);
            }
            const json: LineageData = await res.json();
            setData(json);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError(err.message || 'Failed to fetch family data.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            {/* Increased max-width from max-w-4xl to max-w-7xl */}
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
                <div className="mt-6">
                    {/* Display Lineage (Ancestors) - Title appears first */}
                    { (data.targetCitizen || (data.lineage && data.lineage.length > 0)) && ( // Show title if there's anything for the timeline
                        <h3 
                            className="text-xl sm:text-2xl font-semibold mb-6 text-neutral-content animate-fadeInUp" 
                            style={{ animationDelay: '0.1s' }}
                        >
                            Ancestral Lineage
                        </h3>
                    )}

                    {/* Combined Timeline: Target Citizen + Ancestors */}
                    {/* Removed overflow-x-auto and custom-scrollbar */}
                    <div className="flex flex-row items-stretch space-x-2 md:space-x-3 lg:space-x-4 p-3 md:p-4 rounded-lg bg-base-300/20 mb-8">
                        {/* 1. Target Citizen Card */}
                        <div
                            className="card card-compact bg-primary text-primary-content shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 animate-fadeInUp flex-shrink-0 w-60 sm:w-64 md:w-72"
                            style={{ animationDelay: '0.3s' }}
                        >
                            <div className="card-body p-3 md:p-4">
                                <h4 className="card-title text-md sm:text-lg">
                                    {data.targetCitizen.firstName} {data.targetCitizen.lastName}
                                </h4>
                                <p className="text-xs opacity-90">(Target Individual)</p>
                                <div className="divider my-1 before:bg-primary-content/20 after:bg-primary-content/20"></div>
                                <p className="text-xs sm:text-sm opacity-80"><strong>ID:</strong> {data.targetCitizen.citizenId || data.targetCitizen.id}</p>
                                <p className="text-xs sm:text-sm opacity-80"><strong>Age:</strong> {data.targetCitizen.age}</p>
                                <p className="text-xs sm:text-sm opacity-80"><strong>Relation to Unit:</strong> {data.targetCitizen.relationshipToParentCountry || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Arrow connecting Target Citizen to First Ancestor (if lineage exists) */}
                        {data.lineage && data.lineage.length > 0 && (
                            <div
                                className="flex items-center justify-center text-primary opacity-90 animate-fadeInUp px-1 md:px-2"
                                style={{ animationDelay: '0.5s' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>
                        )}

                        {/* 2. Mapped Ancestor Cards and Arrows */}
                        {(() => {
                            const reversedLineage = [...data.lineage].reverse();
                            return (
                                <>
                                {reversedLineage.map((country, index) => {
                                    const cardDelay = 0.7 + index * 0.4; // Starts at 0.7s, then 1.1s, 1.5s
                                    const arrowDelay = 0.9 + index * 0.4; // Starts at 0.9s, then 1.3s, 1.7s
                                    return (
                                        <React.Fragment key={country.id}>
                                            <div
                                                className="card card-compact bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 animate-fadeInUp flex-shrink-0 w-56 sm:w-60 md:w-64 lg:w-72"
                                                style={{ animationDelay: `${cardDelay}s` }}
                                            >
                                                <div className="card-body p-3 md:p-4">
                                                    <h4 className="card-title text-base sm:text-md md:text-lg text-accent">{country.name}</h4>
                                                    <p className="text-xs sm:text-sm opacity-80"><strong>Role:</strong> {country.roleInFamily || 'N/A'}</p>
                                                    <p className="text-xs sm:text-sm opacity-80"><strong>Location:</strong> {country.location}</p>
                                                    <p className="text-xs sm:text-sm opacity-80"><strong>Unit ID:</strong> {country.countryId || 'N/A'}</p>
                                                </div>
                                            </div>
                                            {index < reversedLineage.length - 1 && (
                                                <div
                                                    className="flex items-center justify-center text-primary opacity-90 animate-fadeInUp px-1 md:px-2"
                                                    style={{ animationDelay: `${arrowDelay}s` }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                    </svg>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                </>
                            );
                        })()}
                    </div>
                    
                    {/* Display Siblings */}
                    {data.siblings && data.siblings.length > 0 && (
                    <div className="mb-8">
                        <h3 
                            className="text-xl sm:text-2xl font-semibold mb-4 text-neutral-content animate-fadeInUp"
                            style={{ animationDelay: '1.5s' }} // Delayed to appear after timeline
                        >
                            Siblings
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.siblings.map((sibling, index) => (
                            <div 
                                key={sibling.id} 
                                className="card card-compact bg-base-200 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1 animate-fadeInUp"
                                style={{ animationDelay: `${1.7 + index * 0.2}s`}} // Staggered animation for sibling cards
                            >
                            <div className="card-body">
                                <h5 className="card-title text-md text-secondary">
                                {sibling.firstName} {sibling.lastName}
                                </h5>
                                <p><strong>ID:</strong> {sibling.citizenId || sibling.id}</p>
                                <p><strong>Age:</strong> {sibling.age}</p>
                                <p><strong>Relationship to Parent Country:</strong> {sibling.relationshipToParentCountry || 'N/A'}</p>
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>
                    )}

                    {/* Message for no additional lineage or siblings */}
                    {!loading && data.targetCitizen && !data.lineage?.length && !data.siblings?.length && (
                    <div role="alert" className="alert alert-info shadow-lg mt-8 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>No further lineage or sibling information found for this citizen beyond their direct details.</span>
                    </div>
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
