/**
 * Parallax — Root Application Component
 * See AGENT.md §8 — Frontend Component Map
 *
 * Routing: / (InputScreen) → /main (MainWindow)
 * State management: React state only (AGENT.md §14 Rule 5 — no localStorage).
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import InputScreen from "./components/InputScreen";
import MainWindow from "./components/MainWindow";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InputScreen />} />
        <Route path="/main" element={<MainWindow />} />
      </Routes>
    </BrowserRouter>
  );
}
