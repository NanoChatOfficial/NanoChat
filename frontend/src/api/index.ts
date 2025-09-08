import axios from "axios";

const onionUrl = import.meta.env.VITE_ONION_URL || "http://localhost:8000";
axios.defaults.baseURL = onionUrl;

export const fetchMessagesAPI = (roomId: string) => {
  return axios.get(`/api/messages/${roomId}`);
};
