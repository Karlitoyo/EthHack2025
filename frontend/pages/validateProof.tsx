import Link from 'next/link';
import Layout from '../components/Layout';
import VerifyProof from '../components/validateProofPage/ValidateProofPage';

const ValidateProofPage = () => (
  <Layout
    title='Validate Proof Page | KinChain'
    stepIdx={5}
  >
    <VerifyProof />
  </Layout>
);

export default ValidateProofPage;
