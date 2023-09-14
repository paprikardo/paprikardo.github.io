import React, { useState } from "react";
import "./Lifetime.css";
import {
  Box,
  Container,
  TextField,
  Typography,
} from "@mui/material";
import LifePhases from "./LifePhases";

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
      state.day < 32
    ) {
      setTrackSetting(state);
    }
  };

  return (
    <Container maxWidth="sm" style={{ backdropFilter: "blur(2px)" }}>
      <Typography
        variant="h4"
        style={{ color: "black", textAlign: "center", marginTop: "20px" }}
      >
        Lifetime Calculator
      </Typography>
      <Typography variant="p">
        One only has limited time to live. When you calculate the amount of
        weeks that you are about to live, your life suddenly feels short.
      </Typography>
      <Typography variant="p">
        Enter your birthday, your expected age of death (Average in Switzerland
        is 82 for men and 86 for women) and the "Inactive age" where you will
        lack body fitness.
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
        />
        <TextField
          label="Inactive Age"
          type="number"
          defaultValue={trackSetting.tooOldAge}
          onChange={(event) => {
            const newState = { ...trackSetting };
            newState.tooOldAge = event.target.value;
            checkAndUpdateSetting(newState);
          }}
        />
      </Box>
      <Box sx={{ marginTop: "10px" }}>
        <Typography variant="p">
          Below represented is your expected time in your life. Each dot
          represents one week. Each row is 52 weeks which is roughly one year.
        </Typography>
      </Box>
      <Box className="legendeBigContainer">
        <Box className="legendeContainer">
          <Box className="childhood"></Box>
          <Box className="legendeText">Your Childhood (until age of 12)</Box>
        </Box>
        <Box className="legendeContainer">
          <Box className="teenager"></Box>
          <Box className="legendeText">
            Your Teenager Time (until age of 20)
          </Box>
        </Box>
        <Box className="legendeContainer">
          <Box className="adult"></Box>
          <Box className="legendeText">Your Adulthood</Box>
        </Box>
        <Box className="legendeContainer">
          <Box className="retired"></Box>
          <Box className="legendeText">Your Time retired </Box>
        </Box>
        <Box className="legendeContainer">
          <Box className="tooOld"></Box>
          <Box className="legendeText">Your Time inactive</Box>
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
        <Typography variant="p">
          This might feel intimidating. But it can also serve as a motivation to
          not miss out on the things that you really want to do. Life is too
          short to not commit to the things that you love.
        </Typography>
      </Box>
    </Container>
  );
};

export default Lifetime;
