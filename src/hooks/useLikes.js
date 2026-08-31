import { createContext, useContext, useState } from "react";

const LikesContext = createContext();

export function LikesProvider({ children }) {
  const [liked, setLiked] = useState({});
  const toggleLike = (id) => setLiked((p) => ({ ...p, [id]: !p[id] }));

  return (
    <LikesContext.Provider value={{ liked, toggleLike }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  return useContext(LikesContext);
}
