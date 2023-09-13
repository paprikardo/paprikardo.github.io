import React, { useState } from "react";
import "./Lifetime.css";
import { Button, Container, TextField, Typography } from "@mui/material";
import LifePhases from "./LifePhases";

const Lifetime = () => {
  const [trackSetting, setTrackSetting] = useState({
    day: 10,
    month: 12,
    year: 2001,
    expAge: 80,
    tooOldAge: 70,
  });
  const [birth, setBirth] = useState({ day: 10, month: 12, year: 2001 });
  const [expAge, setExpAge] = useState(80);
  const [tooOldAge, setTooOldAge] = useState(70);
  const newDate = new Date();
  const checkAndUpdate = () => {
    if (
      trackSetting.year > 1900 &&
      trackSetting.year < newDate.getFullYear() &&
      trackSetting.month > 0 &&
      trackSetting.month < 13 &&
      trackSetting.day > 0 &&
      trackSetting.day < 32
    ) {
      setBirth((state) => {
        return {
          day: trackSetting.day,
          month: trackSetting.month - 1,
          year: trackSetting.year,
        };
      });
      setExpAge(trackSetting.expAge);
      setTooOldAge(trackSetting.tooOldAge);
    }
  };

  return (
    <Container maxWidth="sm">
      <Typography
        variant="h2"
        style={{ color: "black", textAlign: "center", marginTop: "20px" }}
      >
        Lifetime Calculator
      </Typography>
      <Typography variant="h5">
        One only has limited time to live. When you calculate the amount of
        weeks that you are about to live, your life suddenly feels short. This
        might feel intimidating. But it can also serve as a motivation to not
        miss out on the things that you really want to do. Life is too short to
        not commit to the things that you love.
      </Typography>
      <TextField
        key="day"
        label="Day"
        type="number"
        defaultValue={birth.day}
        onChange={(event) =>
          setTrackSetting((state) => {
            state.day = event.target.value;
            return state;
          })
        }
        style={{ width: "30%" }}
      />
      <TextField
        key="month"
        label="Month"
        type="number"
        defaultValue={birth.month}
        onChange={(event) =>
          setTrackSetting((state) => {
            state.month = event.target.value;
            return state;
          })
        }
        style={{ width: "30%" }}
      />
      <TextField
        key="year"
        label="Year"
        type="number"
        defaultValue={birth.year}
        style={{ width: "30%" }}
        onChange={(event) =>{
          setTrackSetting((state) => {
            state.year = event.target.value;
            return state;
          })
          checkAndUpdate()
        }
        }
      />
      <TextField
        label="Expected Age of death"
        type="number"
        defaultValue={expAge}
        onChange={(event) =>
          setTrackSetting((state) => {
            state.expAge = event.target.value;
            return state;
          })
        }
        style={{ width: "30%" }}
      />
      <TextField
        label="Too Old Age"
        type="number"
        defaultValue={tooOldAge}
        onChange={(event) =>
          setTrackSetting((state) => {
            state.tooOldAge = event.target.value.toN;
            return state;
          })
        }
        style={{ width: "30%" }}
      />
      <LifePhases
        expAge={expAge}
        birthDay={birth.day}
        birthMonth={birth.month}
        birthYear={birth.year}
        tooOldAge={tooOldAge}
      ></LifePhases>
    </Container>
  );
};

export default Lifetime;
