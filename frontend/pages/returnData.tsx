import Layout from "../components/Layout";
import FamilySearch from "../components/returnData/ReturnData"; // Updated import

const IndexPage = () => (
  <Layout title="Home | Next.js + TypeScript Example">
    <FamilySearch />
  </Layout>
);

export default IndexPage;
