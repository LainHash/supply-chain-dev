// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Stakeholder.sol";

/**
 * @title Farmer
 * @dev Extends Stakeholder for farmer-specific functionality.
 *
 * Preserved interfaces (used by setup-app.js and ContractContext.js):
 *  - registerFarmer(name, location, role, rawProducts)
 *  - getFarmer(id) -> (stakeholder, string[])
 *  - addRawProduct(rawProduct)
 *  - getRawProductFarmers(rawProduct) -> address[]
 *  - getRole(id)          (inherited from Stakeholder)
 *  - isVerified(id)       (inherited)
 *  - verify(id)           (inherited)
 *  - getAddresses()       (inherited)
 *  - get(id)              (inherited)
 *
 * Added for tests / new requirements:
 *  - register() override (delegates to registerFarmer with empty rawProducts)
 *  - verifyFarmer(id)    alias for verify() – keeps test compatibility
 *  - getFarmersList()    alias for getAddresses()
 *  - addFarmer()         alias for registerFarmer (test compatibility)
 *
 * Events:
 *  - FarmerRegistered(id, name, location)
 *  - FarmerRawProductAdded(farmer, rawProduct)
 */
contract Farmer is Stakeholder {

    // ─── Storage ───────────────────────────────────────────────────────────────

    mapping(address => string[])  public _farmerRawProducts;
    mapping(string  => address[]) public _rawProductFarmers;

    // ─── Events ────────────────────────────────────────────────────────────────

    event FarmerRegistered(address indexed id, string name, string location);
    event FarmerRawProductAdded(address indexed farmer, string rawProduct);

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() Stakeholder() {}

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * @notice Register the caller as a farmer with an initial list of raw products.
     * @param _name       Farmer display name.
     * @param _location   Physical location / region.
     * @param _role       Role string (should be "farmer").
     * @param _rawProducts Initial raw products this farmer supplies.
     */
    function registerFarmer(
        string memory   _name,
        string memory   _location,
        string memory   _role,
        string[] memory _rawProducts
    ) public returns (bool) {
        require(bytes(_name).length > 0,     "Farmer::registerFarmer: name cannot be empty");
        require(bytes(_location).length > 0, "Farmer::registerFarmer: location cannot be empty");
        require(
            _stakeholders[msg.sender].id == address(0),
            "Farmer::registerFarmer: already registered"
        );

        _stakeholders[msg.sender] = stakeholder(msg.sender, _name, _location, _role, false);
        _stakeholderAddresses.push(msg.sender);

        for (uint i = 0; i < _rawProducts.length; i++) {
            require(bytes(_rawProducts[i]).length > 0, "Farmer::registerFarmer: empty raw product name");
            _farmerRawProducts[msg.sender].push(_rawProducts[i]);
            _rawProductFarmers[_rawProducts[i]].push(msg.sender);
        }

        emit StakeholderRegistered(msg.sender, _name, _role);
        emit FarmerRegistered(msg.sender, _name, _location);
        return true;
    }

    /**
     * @notice Alias: register() delegates to registerFarmer with no initial products.
     *         Keeps Stakeholder-level interface consistent (used by Register.js).
     */
    function register(
        string memory _name,
        string memory _location,
        string memory _role
    ) public override returns (bool) {
        string[] memory empty = new string[](0);
        return registerFarmer(_name, _location, _role, empty);
    }

    /**
     * @notice Test-compatible alias for registerFarmer.
     * @dev Tests call `addFarmer(name, location, rawProducts[], {from})`.
     */
    function addFarmer(
        string memory   _name,
        string memory   _location,
        string[] memory _rawProducts
    ) public returns (bool) {
        return registerFarmer(_name, _location, "farmer", _rawProducts);
    }

    // ─── Raw product management ────────────────────────────────────────────────

    /**
     * @notice Add a new raw product that the caller (a registered farmer) can supply.
     */
    function addRawProduct(string memory _rawProduct) public returns (bool) {
        require(
            _stakeholders[msg.sender].id != address(0),
            "Farmer::addRawProduct: caller not registered as farmer"
        );
        require(bytes(_rawProduct).length > 0, "Farmer::addRawProduct: product name cannot be empty");

        // Prevent duplicate entries
        for (uint i = 0; i < _farmerRawProducts[msg.sender].length; i++) {
            require(
                keccak256(abi.encodePacked(_farmerRawProducts[msg.sender][i])) !=
                keccak256(abi.encodePacked(_rawProduct)),
                "Farmer::addRawProduct: raw product already registered"
            );
        }

        _farmerRawProducts[msg.sender].push(_rawProduct);
        _rawProductFarmers[_rawProduct].push(msg.sender);
        emit FarmerRawProductAdded(msg.sender, _rawProduct);
        return true;
    }

    // ─── Retrieval ─────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve a farmer's core record and their raw product list.
     * @dev Preserved signature used by setup-app.js and ContractContext.js.
     */
    function getFarmer(address _id) public view returns (
        stakeholder memory farmer,
        string[]    memory rawProducts
    ) {
        farmer     = _stakeholders[_id];
        rawProducts = _farmerRawProducts[_id];
    }

    /**
     * @notice Returns all farmer/stakeholder addresses (admin verify UI).
     * @dev Alias for getAddresses(); test-compatible name.
     */
    function getFarmersList() public view returns (address[] memory) {
        return _stakeholderAddresses;
    }

    /**
     * @notice Returns all farmer addresses that supply a given raw product.
     */
    function getRawProductFarmers(string memory _rawProduct) public view returns (address[] memory) {
        return _rawProductFarmers[_rawProduct];
    }

    // ─── Admin operations ──────────────────────────────────────────────────────

    /**
     * @notice Admin verifies a farmer (wraps Stakeholder.verify).
     * @dev Test-compatible alias: tests call `verifyFarmer(address, {from: admin})`.
     */
    function verifyFarmer(address _id) public onlyAdmin returns (bool) {
        return verify(_id);
    }
}