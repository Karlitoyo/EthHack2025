import Layout from "../components/Layout";
import FamilyComponent from "../components/FamilyRegisterPage/FamilyRegister";

const IndexPage = () => (
  <Layout title="Relation Page | KinChain" stepIdx={1}>
    <FamilyComponent />
  </Layout>
);

export default IndexPage;
