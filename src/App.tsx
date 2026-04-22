import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import CloseCockpit from "@/screens/CloseCockpit";
import ContractQueue from "@/screens/ContractQueue";
import ContractReview from "@/screens/ContractReview";
import AccrualProposal from "@/screens/AccrualProposal";
import Narrative from "@/screens/Narrative";
import CopilotPanel from "@/screens/CopilotPanel";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CloseCockpit />} />
        <Route path="contracts" element={<ContractQueue />} />
        <Route path="contracts/:id" element={<ContractReview />} />
        <Route path="contracts/:id/accrual" element={<AccrualProposal />} />
        <Route path="narrative" element={<Narrative />} />
        <Route path="copilot" element={<CopilotPanel />} />
      </Route>
    </Routes>
  );
}
