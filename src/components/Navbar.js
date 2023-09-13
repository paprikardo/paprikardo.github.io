import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  ListItemText,
  Avatar,
  Divider,
  List,
  Typography,
  Box,
  ListItemIcon,
  ListItemButton,
  Drawer,
} from "@mui/material";
import { AssignmentInd, Home, Apps, Menu } from "@material-ui/icons";
import BoyIcon from '@mui/icons-material/Boy';
import { makeStyles } from "@material-ui/core";
import { Link } from "react-router-dom";

const brightColor = "#f0f6ff";
const myBlue = "#288bbd";
const avatar = "/profile.jpeg";
const resume = "/LebenslaufSept2023.pdf";

//CSS STYLES
const useStyles = makeStyles((theme) => ({
  menuSliderContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: 250,
    background: myBlue,
    height: "100%",
  },
  avatar: {
    display: "block",
    margin: "0.5rem auto",

    width: theme.spacing(13),
    height: theme.spacing(13),
  },
}));

const menuItems = [
  { listIcon: <Home />, listText: "Home", component: Link, listPath: "/" },
  { listIcon: <AssignmentInd />, listText: "Resume" },
  { listIcon: <Apps />, listText: "Others", listPath: "" },
];

const Navbar = (props) => {
  const [sidebarShown, setSidebarShown] = useState(false);
  const classes = useStyles();

  const sideList = (slider) => (
    <Box className={classes.menuSliderContainer} component="div">
      <Avatar
        sx={{ width: 56, height: 56 }}
        className={classes.avatar}
        src={avatar}
        alt="Ricardo Heinzmann"
        onClick={() => setSidebarShown(false)}
      ></Avatar>
      <Divider />
      <List>
        <ListItemButton
          component={Link}
          to={"/"}
          onClick={() => setSidebarShown(false)}
        >
          <ListItemIcon>
            <Home />
          </ListItemIcon>
          <ListItemText primary={"Home"}></ListItemText>
        </ListItemButton>
        <Divider />
        <ListItemButton
          onClick={() => {
            setSidebarShown(false);
            window.location = resume;
          }}
        >
          <ListItemIcon>
            <AssignmentInd />
          </ListItemIcon>
          <ListItemText primary={"Resume"}></ListItemText>
        </ListItemButton>
        <Divider />
        <ListItemButton
          component={Link}
          to={"/lifetime"}
          onClick={() => {
            setSidebarShown(false);
          }}
        >
          <ListItemIcon>
            <BoyIcon></BoyIcon>
          </ListItemIcon>
          <ListItemText primary={"Lifetime"}></ListItemText>
        </ListItemButton>
      </List>
    </Box>
  );
  return (
    <>
      <Box component="nav">
        <AppBar position="static" style={{ background: "#288bbd" }}>
          <Toolbar>
            <IconButton onClick={() => setSidebarShown(true)}>
              <Menu style={{ color: brightColor }}></Menu>
            </IconButton>
            <Typography variant="h5" style={{ color: brightColor }}>
              Portfolio
            </Typography>
            <Drawer open={sidebarShown} onClose={() => setSidebarShown(false)}>
              {sideList("right")}
            </Drawer>
          </Toolbar>
        </AppBar>
      </Box>
    </>
  );
};

export default Navbar;
