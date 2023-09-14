import * as React from "react";
import CssBaseline from "@mui/material/CssBaseline";
import Link from "@mui/material/Link";
//import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import "./App.css";
import Header from "./components/Header";
import Lifetime from "./components/Lifetime/Lifetime";
import Navbar from "./components/Navbar";

import { Route, Routes, HashRouter } from "react-router-dom";

function Copyright(props) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      <Link color="inherit" href="https://www.flaticon.com/free-icons/letter-r">
        Icon
      </Link>{" "}
      created by Md Tanvirul Haque
      {", Copyright © "}
      <Link color="inherit" href="https://ricardoheinzmann.com/">
        Ricardo Heinzmann
      </Link>{" "}
      {new Date().getFullYear()}
      {"."}
    </Typography>
  );
}

const defaultTheme = createTheme();

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider theme={defaultTheme}>
        <Container component="main" maxWidth="xm">
          <CssBaseline />
          <Navbar></Navbar>
          <Routes>
            <Route path="/" element={<Header></Header>}></Route>
            <Route path="/lifetime" element={<Lifetime></Lifetime>}></Route>
          </Routes>
          <Copyright sx={{ mt: 8, mb: 4 }} />
        </Container>
      </ThemeProvider>
    </HashRouter>
  );
}
