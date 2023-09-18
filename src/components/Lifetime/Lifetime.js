import React, { useState } from "react";
import "./Lifetime.css";
import { Box, Container, TextField, Typography } from "@mui/material";
import LifePhases from "./LifePhases";

const backgroundWithOpacity = "rgba(46, 58, 64 ,0.6)";
const brightColor = "#f0f6ff";

const Lifetime = () => {
  const [trackSetting, setTrackSetting] = useState({
    day: 10,
    month: 12,
    year: 2001,
    expAge: 80,
    tooOldAge: 70,
  });
  const newDate = new Date();
  const checkAndUpdateSetting = (state) => {
    if (
      state.year > 1900 &&
      state.year < newDate.getFullYear() &&
      state.month > 0 &&
      state.month < 13 &&
      state.day > 0 &&
      state.day < 32 &&
      state.expAge < 150 &&
      state.expAge > 0 &&
      state.tooOldAge > 0 &&
      state.tooOldAge < 150
    ) {
      setTrackSetting(state);
    }
  };

  return (
    <Container
      maxWidth="md"
      style={{
        backgroundColor: backgroundWithOpacity,
        backdropFilter: "blur(2px)",
        borderRadius: "20px",
        outline: "1px solid",
        outlineColor: brightColor,
        marginTop: "20px",
        paddingTop: "5%",
        paddingBottom: "5%",
      }}
    >
      <Container maxWidth="sm">
        <Typography
          variant="h4"
          style={{ color: brightColor, textAlign: "center" }}
        >
          Lifetime Calculator
        </Typography>
        <Typography variant="p" style={{ color: brightColor }}>
          One only has limited time to live. When you calculate the amount of
          weeks that you are about to live, your life suddenly feels short.
        </Typography>
        <br></br>
        <Typography variant="p" style={{ color: brightColor }}>
          Enter your birthday, your expected age of death (Average in
          Switzerland is 82 for men and 86 for women) and the "Inactive age"
          where you will lack body fitness.
        </Typography>
        <Box
          sx={{
            marginTop: "10px",
            display: "flex",
            justifyContent: "space-evenly",
          }}
        >
          <TextField
            key="day"
            label="Day"
            type="number"
            defaultValue={trackSetting.day}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.day = event.target.value;
              checkAndUpdateSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            key="month"
            label="Month"
            type="number"
            defaultValue={trackSetting.month}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.month = event.target.value - 1;
              checkAndUpdateSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            key="year"
            label="Year"
            type="number"
            defaultValue={trackSetting.year}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.year = event.target.value;
              checkAndUpdateSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
        </Box>
        <Box sx={{ marginTop: "10px", justifyContent: "space-evenly" }}>
          <TextField
            label="Expected Age of death"
            type="number"
            defaultValue={trackSetting.expAge}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.expAge = event.target.value;
              checkAndUpdateSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            label="Inactive Age"
            type="number"
            defaultValue={trackSetting.tooOldAge}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.tooOldAge = event.target.value;
              checkAndUpdateSetting(newState);
            }}
          />
        </Box>
        <Box sx={{ marginTop: "10px" }}>
          <Typography variant="p" style={{ color: brightColor }}>
            Below represented is your expected time in your life. Each dot
            represents one week. Each row is 52 weeks which is roughly one year.
          </Typography>
        </Box>
        <Box className="legendeBigContainer">
          <Box className="legendeContainer">
            <Box className="childhood"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Childhood (until age of 12)
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="teenager"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Teenager Time (until age of 20)
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="adult"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Adulthood
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="retired"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Time retired{" "}
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="tooOld"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Time inactive
            </Box>
          </Box>
        </Box>
        <LifePhases
          expAge={trackSetting.expAge}
          birthDay={trackSetting.day}
          birthMonth={trackSetting.month}
          birthYear={trackSetting.year}
          tooOldAge={trackSetting.tooOldAge}
        ></LifePhases>
        <Box sx={{ marginTop: "20px" }}>
          <Typography variant="p" style={{ color: brightColor }}>
            This might feel intimidating. But it can also serve as a motivation
            to not miss out on the things that you really want to do. Life is
            too short to not commit to the things that you love.
          </Typography>
        </Box>
      </Container>
    </Container>
  );
};

export default Lifetime;
