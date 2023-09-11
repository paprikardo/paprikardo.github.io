import React from "react";
import { Typography, Avatar, Grid, Box } from "@mui/material";
import Typed from "react-typed";
import profile from "../profile_masked.png";

const brightColor = "#f0f6ff";
const myBlue = "#288bbd";

const Header = (props) => {
  return (
    <Grid
      container
      direction="column"
      alignItems="center"
      justifyContent="center"
      spacing={4}
      style={{ width: "100vw",  marginTop: "20px"}}
    >
      <Grid
        item
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          style={{
            width: "80%",
            maxWidth:"400px",
            borderRadius: "10%",
            border: "4px solid black",
          }}
          src={profile}
          alt=""
        ></img>
      </Grid>
      <Grid item container direction="column" justifyItems="center">
        <Grid item>
          <Typography
            style={{ color: myBlue, textAlign: "center" }}
            variant="h3"
          >
            <Typed
              typeSpeed={80}
              backSpeed={100}
              showCursor={false}
              backDelay={6000}
              loop
              strings={["Hello!", "Hallo!", "Hola!"]}
            ></Typed>
          </Typography>
        </Grid>
        <Grid item>
          <Typography variant="h4" style={{textAlign: "center" }}>
            <Typed
              typeSpeed={80}
              backSpeed={100}
              showCursor={false}
              backDelay={6000}
              loop
              strings={["I am","Ich bin", "Yo soy" ]}
            ></Typed>
          </Typography>
        </Grid>
        <Grid item>
          <Typography
            style={{ color: myBlue, textAlign: "center" }}
            variant="h4"
          >
            <Typed
              typeSpeed={30}
              backSpeed={60}
              showCursor={false}
              loop
              strings={["Ricardo Heinzmann", "Data Engineer at Accenture"]}
            ></Typed>
          </Typography>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default Header;
