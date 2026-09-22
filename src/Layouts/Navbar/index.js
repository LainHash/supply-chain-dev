import { useContext, useState } from "react";
import { Collapse, Nav, Navbar, NavbarBrand, NavbarText, NavbarToggler, NavItem, Button } from "reactstrap";
import { NavLink, useNavigate } from 'react-router-dom';

import logo from '../../Assests/Images/logo_mini.png';
import { AuthContext } from "../../Services/Contexts/AuthContext";
import QRScannerModal from "../../Components/Modals/QRScannerModal";

const Header = () => {
  const {authState, connectWallet, logout}  = useContext(AuthContext);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const navigate = useNavigate();

  const isAuthenticated = authState.isAuthenticated;
  const role = authState.stakeholder.role;
  const style = {
    authButton: {
      fontWeight: 'bolder',
      color: '#fff',
    },
    authText: {
      color: '#fff',
    }
  }

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  }

  const toggleScanner = () => {
    setIsScannerOpen(!isScannerOpen);
  }

  const handleScanSuccess = (productId) => {
    navigate(`/trace/${productId}`);
  }

  const roleNavLinks = () => {
    switch(role) {
      case 'admin':
        return (
          <>
          <NavItem>
            <NavLink to="/admin/verify/farmer" className="nav-link">Verify Farmer</NavLink>
          </NavItem>
          <NavItem>
            <NavLink to="/admin/verify/manufacturer" className="nav-link">Verify Manufacturer</NavLink>
          </NavItem>
          </>
        )
      case 'farmer':
        return (
          <>
          <NavItem>
            <NavLink to={`/farmers/${authState.stakeholder.id}`} className="nav-link">Profile</NavLink>
          </NavItem>
          </>
        )
      case 'manufacturer':
        return (
          <>
          <NavItem>
            <NavLink to={`/manufacturers/${authState.stakeholder.id}`} className="nav-link">Profile</NavLink>
          </NavItem>
          </>
        )
      case 'new': 
        return (
          <>
          <NavItem>
            <NavLink to="register" className="nav-link">Register</NavLink>
          </NavItem>
          </>
        )
      default:
        return (
          <>
          <NavItem>
            <NavLink to="profile" className="nav-link">Profile</NavLink>
          </NavItem>
          </>
        )
    }
  }

  return (
    <div className="container">
      <Navbar 
        color="warning"
        expand='md' 
        dark
      >
        <NavbarBrand href="/">
          <img src={logo} alt="logo" />
          Global Supply Solutions
        </NavbarBrand>
        <NavbarToggler onClick={toggleNav} >
          {isNavOpen?
            <i className="fa fa-times"></i>
          :
            <i className="fa fa-bars"></i>
          }
        </NavbarToggler>
        <Collapse navbar isOpen={isNavOpen}>
          <Nav className="mx-auto" navbar >
            {/* Luôn hiển thị Truy Xuất QR cho mọi người dùng */}
            <NavItem>
              <NavLink className="nav-link fw-bold text-dark" to="/trace">
                <i className="fa fa-qrcode me-1" /> Truy Xuất QR
              </NavLink>
            </NavItem>
            { isAuthenticated?
              <>
              <NavItem>
                <NavLink className="nav-link" to="/">
                  Dashboard
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink className="nav-link" to="/products">
                  Products
                </NavLink>
              </NavItem>
              { roleNavLinks() }
              </>
            :
              ""
            }
          </Nav>
          <Nav className="ms-auto d-flex align-items-center" navbar>
            <NavItem className="me-2">
              <Button 
                color="dark" 
                size="sm" 
                className="d-flex align-items-center"
                onClick={toggleScanner}
                title="Quét mã QR bằng máy ảnh"
              >
                <i className="fa fa-camera me-1" /> Quét QR
              </Button>
            </NavItem>
            { isAuthenticated?
              <>
              <NavbarText style={style.authText}>
                {authState.formattedAddress} &nbsp;
              </NavbarText>
              <NavItem>
                <NavbarText type="button" onClick={logout} style={style.authButton}>
                  <i className="fa fa-sign-out fa-lg"/>Logout
                </NavbarText>
              </NavItem>
              </>
            :
              <>
              <NavItem>
                <NavbarText type="button" onClick={connectWallet} style={style.authButton}>
                <i className="fa fa-sign-in fa-lg"/> Login
                </NavbarText>
              </NavItem>
              </>
            }
          </Nav>
        </Collapse>
      </Navbar>

      <QRScannerModal
        isOpen={isScannerOpen}
        toggle={toggleScanner}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  )
}
export default Header;