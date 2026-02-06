import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8000', //FastAPI 서버 주소
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;