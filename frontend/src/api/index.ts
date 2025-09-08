
import axios from "axios";

axios.defaults.baseURL = "http://localhost:8000";

export const fetchMessagesAPI = (roomId: string) => {
  return axios.get(`/api/messages/${roomId}`);
};
