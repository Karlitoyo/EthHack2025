import React, { useState } from 'react';

export default function TreatmentSearch() {
    const [treatment, setTreatment] = useState('');
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchTreatmentData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:4001/patients/treatment/${treatment}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card w-full max-w-4xl bg-base-100 shadow-xl mx-auto">
            <div className="card-body">
                <h2 className="card-title text-2xl">Search Hospitals & Patients by Treatment</h2>

                <div className="form-control w-full mb-4">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Enter treatment (e.g. burn)"
                            value={treatment}
                            onChange={(e) => setTreatment(e.target.value)}
                            className="input input-bordered w-full"
                        />
                        <button
                            onClick={fetchTreatmentData}
                            disabled={!treatment || loading}
                            className="btn btn-primary"
                        >
                            {loading ? <span className="loading loading-spinner"></span> : 'Search'}
                        </button>
                    </div>
                </div>

                {data && data.hospitals.length > 0 ? (
                    <div>
                        <h3 className="text-xl font-semibold mb-2">
                            Hospitals treating: <span className="text-primary">{data.treatment}</span>
                        </h3>
                        {data.hospitals.map((hospital: any) => (
                            <div key={hospital.id} className="card bg-base-100 shadow-sm mb-4">
                                <div className="card-body">
                                    <h4 className="card-title">{hospital.name}</h4>
                                    <p className="text-opacity-70">{hospital.location}</p>

                                    <div className="divider">Patients</div>
                                    {hospital.patients.length > 0 ? (
                                        <ul className="menu bg-base-200 rounded-box">
                                            {hospital.patients.map((patient: any) => (
                                                <li key={patient.id}>
                                                    <a>
                                                        {patient.firstName} {patient.lastName}, Age: {patient.age}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-opacity-50">No patients with this treatment at this hospital.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : data && (
                    <div className="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>No hospitals found for treatment: "{treatment}"</span>
                    </div>
                )}
            </div>
        </div>
    );
}
