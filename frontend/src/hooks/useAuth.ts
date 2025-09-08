
import { useEffect } from "react";

function askForUserName() {
  if (localStorage.getItem("username")) return;
  const name = prompt("Enter your username:");
  if (name) {
    localStorage.setItem("username", name);
  } else {
    localStorage.setItem("username", "Anonymous");
  }
}

export function useAuth() {
  useEffect(() => {
    askForUserName();
  }, []);
}
