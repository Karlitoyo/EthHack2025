import { useState } from 'react';

const HospitalComponent = () => {
    const [proof, setProof] = useState(null);
    const [isValid, setIsValid] = useState(null);

    const [formData, setFormData] = useState({
        id: '',
        name: '',
        location: '',
        treatment: '',
        contactNumber: '',
        adminName: '',
        capacity: '',
    });
    console.log('Form data:', formData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateProof = async () => {
        try {
            const response = await fetch('http://localhost:4001/hospitals/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            const result = await response.json();
            setProof(result);
        } catch (error) {
            console.error('Proof generation error:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold">ZK-SNARK Example</h1>
                    <p className="mb-4">Generate and verify a zero-knowledge proof.</p>

                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">ID</span>
                                </label>
                                <input type="text"
                                    name="id"
                                    value={formData.id}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter ID" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Name</span>
                                </label>
                                <input type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter hospital name" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Location</span>
                                </label>
                                <input type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter location" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Capacity</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="capacity"
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter capacity of unit" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Contact Number</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="contactNumber"
                                    value={formData.contactNumber}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter contact number" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Admin Name</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="adminName"
                                    value={formData.adminName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter admin name" />
                            </div>
                        </div>
                        <select className="select select-bordered w-full"
                                name="treatment"
                                value={formData.treatment}
                                onChange={handleChange}
                                required>
                                <option disabled value="">Select Treatment</option>
                                <option>Injury</option>
                                <option>Check up</option>
                                <option>Burn</option>
                                <option>Fracture</option>
                                <option>Dietary</option>
                            </select>
                    </form>

                    <div className="flex gap-2 mb-4 mt-4">
                        <button className="btn btn-primary" onClick={generateProof}>Create Hospital</button>
                    </div>

                    {isValid !== null && (
                        <div className={`alert ${isValid ? 'alert-success' : 'alert-error'}`}>
                            <div>
                                {isValid ?
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> :
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                }
                                <span>{isValid ? 'Valid' : 'Invalid'} proof</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HospitalComponent;