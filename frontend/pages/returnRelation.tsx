import Link from 'next/link';
import Layout from '../components/Layout';
import FamilySearch from '../components/returnData/ReturnData'; // Updated import

const IndexPage = () => (
  <Layout
    title='Return Relation Page | KinChain'
    stepIdx={3}
  >
    <div className='flex justify-between max-w-2xl mx-auto p-6 pb-0'>
      <Link
        href='/userRegister'
        className={'btn btn-outline'}
      >
        Back
      </Link>
      <Link
        href='/generateProof'
        className={'btn btn-outline'}
      >
        Next
      </Link>
    </div>
    <FamilySearch />
  </Layout>
);

export default IndexPage;
