import React from "react";
import { Typography, Grid } from "@mui/material";
import Typed from "react-typed";

const avatar = "/profile.jpeg";

const brightColor = "#f0f6ff";
//const myBlue = "#288bbd";

const Header = (props) => {
  return (
    <Grid
      container
      direction="column"
      alignItems="center"
      justifyContent="flex-start"
      spacing={4}
      style={{ width: "100vw", height: "70vh", marginTop: "20px" }}
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
            maxWidth: "400px",
            borderRadius: "10%",
            border: "4px solid black",
            backdropFilter: "blur(4px)",
          }}
          src={avatar}
          alt=""
        ></img>
      </Grid>
      <Grid
        item
        container
        direction="column"
        justifyItems="center"
        style={{ backdropFilter: "blur(2px)" }}
      >
        <Grid item>
          <Typography
            style={{
              color: brightColor,
              textAlign: "center",
              fontFamily: ["Times", "Times New Roman", "serif"],
            }}
            variant="h4"
          >
            <Typed
              typeSpeed={80}
              backSpeed={100}
              showCursor={false}
              backDelay={5000}
              loop
              strings={["Hello!", "Hallo!", "Hola!"]}
            ></Typed>
          </Typography>
        </Grid>
        <Grid item>
          <Typography
            variant="h4"
            style={{
              textAlign: "center",
              fontFamily: ["Times", "Times New Roman", "serif"],
              color: brightColor,
            }}
          >
            <Typed
              typeSpeed={80}
              backSpeed={100}
              showCursor={false}
              backDelay={3000}
              loop
              strings={[
                "I am Ricardo Heinzmann",
                "Ich bin Ricardo Heinzmann",
                "Yo soy Ricardo Heinzmann",
              ]}
            ></Typed>
          </Typography>
        </Grid>
        <Grid item>
          <Typography
            style={{
              color: brightColor,
              textAlign: "center",
              fontFamily: ["Courier New", "Lucida Console"],
            }}
            variant="h4"
          >
            <Typed
              typeSpeed={80}
              backSpeed={100}
              showCursor={false}
              backDelay={3000}
              loop
              strings={["Data Engineer at Accenture"]}
            ></Typed>
          </Typography>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default Header;
