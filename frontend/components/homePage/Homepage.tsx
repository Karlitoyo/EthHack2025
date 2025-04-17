import { useState } from 'react';

const ZKComponent = () => {
    const [proof, setProof] = useState(null);
    const [isValid, setIsValid] = useState(null);

    const [formData, setFormData] = useState({
        patientId: '',
        firstName: '',
        lastName: '',
        age: '',
        address: '',
        dateOfBirth: '',
        treatment: '',
        email: '',
        contactNumber: '',
    });
    console.log('Form data:', formData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateProof = async () => {
        try {
            const response = await fetch('http://localhost:4001/patients/create', {
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

    const verifyProof = async () => {
        console.log("Payload sent to Rust verify-proof:", JSON.stringify(proof, null, 2));
        if (!proof) return alert('Generate proof first');
        try {
            const response = await fetch('http://localhost:4001/zk-snark/verify-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(proof),
            });
            const result = await response.json();
            console.log('Proof sent:', JSON.stringify(proof));
            console.log('Public Input sent:', JSON.stringify(proof.public_input));
            setIsValid(result);
        } catch (error) {
            console.error('Proof verification error:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold">ZK-SNARK Example</h1>
                    <p className="mb-4">Generate Patient Record.</p>

                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">ID</span>
                                </label>
                                <input type="text"
                                    name="patientId"
                                    value={formData.patientId}
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
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter name" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Surname</span>
                                </label>
                                <input type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter surname" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Age</span>
                                </label>
                                <input type="number" 
                                className="input input-bordered w-full" 
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                placeholder="Enter age" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Contact Number</span>
                                </label>
                                <input type="number" 
                                className="input input-bordered w-full" 
                                name="contactNumber"
                                value={formData.contactNumber}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                placeholder="Enter phone number" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">E-mail</span>
                                </label>
                                <input type="text" 
                                className="input input-bordered w-full" 
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                placeholder="E-mail" />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Address</span>
                            </label>
                            <textarea 
                            className="textarea textarea-bordered w-full" 
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            required
                            autoComplete="off"
                            placeholder="Enter address"></textarea>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Date of Birth</span>
                            </label>
                            <input type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                            className="input input-bordered w-full" />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Treatment</span>
                            </label>
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
                        </div>
                    </form>

                    <div className="flex gap-2 mb-4 mt-4">
                        <button className="btn btn-primary" onClick={generateProof}>Generate Proof</button>
                        <button className="btn btn-accent" onClick={verifyProof}>Verify Proof</button>
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

export default ZKComponent;