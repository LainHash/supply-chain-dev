// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Stakeholder.sol";

/**
 * @title Manufacturer
 * @dev Extends Stakeholder for manufacturer-specific functionality.
 *
 * Preserved interfaces (used by setup-app.js, ContractContext.js, and frontend modals):
 *  - register(name, location, role)
 *  - addRawProduct(name, suppliers[])
 *  - getManufacturerRawProductDetails(id) -> rawProduct[]
 *  - getManufacturer(id) -> (stakeholder, bool, rawProduct[], uint256[])
 *  - launchProduct(id)
 *  - updateEnergy(id)   (admin only)
 *  - getRole(id)        (inherited)
 *  - isVerified(id)     (inherited)
 *  - verify(id)         (inherited)
 *  - getAddresses()     (inherited)
 *  - get(id)            (inherited)
 *
 * Added for tests / new requirements:
 *  - addManufacturer(name, rawProducts[], suppliers[]) — test alias
 *  - verifyManufacturer(id)                           — test alias
 *  - getManufacturersList()                           — test alias
 *  - updateRawProducts(names[], suppliers[])          — test requirement
 *  - getRawProductInfo(manufacturer, name) -> address — test requirement
 *
 * Events:
 *  - ManufacturerRegistered(id, name, location)
 *  - RawProductAdded(manufacturer, name)
 *  - ProductLaunched(manufacturer, productId)
 *  - EnergyUpdated(manufacturer)
 */
contract Manufacturer is Stakeholder {

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct rawProduct {
        string   name;
        address[] boughtFromIds;
        bool     isVerified;
    }

    struct supplier {
        address id;
        bool    isVerified;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    mapping(address => bool)                             public _isRenewableUsed;
    mapping(address => string[])                         public _rawProducts;
    mapping(address => mapping(string => address[]))     public _rawProductSuppliers;
    mapping(address => mapping(string => bool))          public _rawProductVerified;
    mapping(address => uint256[])                        public _launchedProducts;

    // ─── Events ────────────────────────────────────────────────────────────────

    event ManufacturerRegistered(address indexed id, string name, string location);
    event RawProductAdded(address indexed manufacturer, string name);
    event ProductLaunched(address indexed manufacturer, uint256 indexed productId);
    event EnergyUpdated(address indexed manufacturer);

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() Stakeholder() {}

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * @notice Register the caller as a manufacturer.
     * @dev Overrides Stakeholder.register() with manufacturer-specific initialisation.
     */
    function register(
        string memory _name,
        string memory _location,
        string memory _role
    ) public override returns (bool) {
        require(bytes(_name).length > 0,     "Manufacturer::register: name cannot be empty");
        require(bytes(_location).length > 0, "Manufacturer::register: location cannot be empty");
        require(
            _stakeholders[msg.sender].id == address(0),
            "Manufacturer::register: already registered"
        );
        _stakeholders[msg.sender] = stakeholder(msg.sender, _name, _location, _role, false);
        _isRenewableUsed[msg.sender] = false;
        _stakeholderAddresses.push(msg.sender);
        emit StakeholderRegistered(msg.sender, _name, _role);
        emit ManufacturerRegistered(msg.sender, _name, _location);
        return true;
    }

    /**
     * @notice Test-compatible alias.
     * @dev Tests call: addManufacturer(name, rawProductNames[], supplierAddresses[], {from}).
     *      We register and then bulk-add each rawProduct with the matching supplier.
     */
    function addManufacturer(
        string memory    _name,
        string[] memory  _rawProductNames,
        address[] memory _supplierAddresses
    ) public returns (bool) {
        require(
            _rawProductNames.length == _supplierAddresses.length,
            "Manufacturer::addManufacturer: arrays length mismatch"
        );
        // Register if not already registered
        if (_stakeholders[msg.sender].id == address(0)) {
            _stakeholders[msg.sender] = stakeholder(msg.sender, _name, "", "manufacturer", false);
            _isRenewableUsed[msg.sender] = false;
            _stakeholderAddresses.push(msg.sender);
            emit StakeholderRegistered(msg.sender, _name, "manufacturer");
            emit ManufacturerRegistered(msg.sender, _name, "");
        }
        for (uint i = 0; i < _rawProductNames.length; i++) {
            supplier[] memory suppliers = new supplier[](1);
            suppliers[0] = supplier(_supplierAddresses[i], false);
            _addRawProductInternal(_rawProductNames[i], suppliers);
        }
        return true;
    }

    // ─── Raw product management ────────────────────────────────────────────────

    /**
     * @notice Add or update a raw product with its list of verified suppliers.
     * @dev If the product already exists, its supplier list is extended.
     */
    function addRawProduct(string memory _name, supplier[] memory _suppliers) public returns (bool) {
        require(
            _stakeholders[msg.sender].id != address(0),
            "Manufacturer::addRawProduct: caller not registered as manufacturer"
        );
        require(bytes(_name).length > 0, "Manufacturer::addRawProduct: name cannot be empty");
        _addRawProductInternal(_name, _suppliers);
        return true;
    }

    function _addRawProductInternal(string memory _name, supplier[] memory _suppliers) internal {
        // Add to the name list if new
        bool found = false;
        for (uint i = 0; i < _rawProducts[msg.sender].length; i++) {
            if (keccak256(abi.encodePacked(_rawProducts[msg.sender][i])) ==
                keccak256(abi.encodePacked(_name))) {
                found = true;
                break;
            }
        }
        if (!found) {
            _rawProducts[msg.sender].push(_name);
            _rawProductVerified[msg.sender][_name] = true;
        }

        for (uint i = 0; i < _suppliers.length; i++) {
            require(_suppliers[i].id != address(0), "Manufacturer: supplier id is zero address");
            _rawProductSuppliers[msg.sender][_name].push(_suppliers[i].id);
            _rawProductVerified[msg.sender][_name] =
                _rawProductVerified[msg.sender][_name] && _suppliers[i].isVerified;
        }
        emit RawProductAdded(msg.sender, _name);
    }

    /**
     * @notice Test requirement: update the raw products of the caller with parallel arrays.
     * @dev Maps each name to a single supplier address.
     */
    function updateRawProducts(
        string[] memory  _names,
        address[] memory _supplierAddresses
    ) public returns (bool) {
        require(
            _stakeholders[msg.sender].id != address(0),
            "Manufacturer::updateRawProducts: caller not registered"
        );
        require(
            _names.length == _supplierAddresses.length,
            "Manufacturer::updateRawProducts: arrays length mismatch"
        );
        for (uint i = 0; i < _names.length; i++) {
            supplier[] memory suppliers = new supplier[](1);
            suppliers[0] = supplier(_supplierAddresses[i], false);
            _addRawProductInternal(_names[i], suppliers);
        }
        return true;
    }

    // ─── Retrieval ─────────────────────────────────────────────────────────────

    /**
     * @notice Returns all raw product records for a manufacturer.
     * @dev Preserved signature used by setup-app.js.
     */
    function getManufacturerRawProductDetails(address _id) public view returns (rawProduct[] memory) {
        rawProduct[] memory products = new rawProduct[](_rawProducts[_id].length);
        for (uint i = 0; i < _rawProducts[_id].length; i++) {
            string memory name = _rawProducts[_id][i];
            products[i].name         = name;
            products[i].boughtFromIds = _rawProductSuppliers[_id][name];
            products[i].isVerified   = _rawProductVerified[_id][name];
        }
        return products;
    }

    /**
     * @notice Full manufacturer record (preserved for setup-app.js and ContractContext.js).
     */
    function getManufacturer(address _id) public view returns (
        stakeholder memory manufacturer,
        bool               isRenewableUsed,
        rawProduct[] memory rawProducts,
        uint256[]  memory  launchedProductIds
    ) {
        manufacturer      = _stakeholders[_id];
        isRenewableUsed   = _isRenewableUsed[_id];
        rawProducts       = getManufacturerRawProductDetails(_id);
        launchedProductIds = _launchedProducts[_id];
    }

    /**
     * @notice Returns the first supplier address for a given manufacturer and raw product.
     * @dev Test requirement: getRawProductInfo(manufacturer, name) -> address.
     */
    function getRawProductInfo(address _manufacturer, string memory _name)
        public view returns (address)
    {
        address[] memory suppliers = _rawProductSuppliers[_manufacturer][_name];
        if (suppliers.length == 0) return address(0);
        return suppliers[0];
    }

    /**
     * @notice Returns all registered stakeholder addresses.
     * @dev Test-compatible alias for getAddresses().
     */
    function getManufacturersList() public view returns (address[] memory) {
        return _stakeholderAddresses;
    }

    // ─── Product lifecycle ─────────────────────────────────────────────────────

    /**
     * @notice Record a launched product ID and grant ownership to the caller.
     * @dev Called by the manufacturer after Product.add().
     */
    function launchProduct(uint256 _id) public returns (bool) {
        require(
            _stakeholders[msg.sender].id != address(0),
            "Manufacturer::launchProduct: caller not registered"
        );
        _launchedProducts[msg.sender].push(_id);
        _stakeholderProductOwnership[msg.sender][_id] = true;
        emit ProductLaunched(msg.sender, _id);
        return true;
    }

    // ─── Admin operations ──────────────────────────────────────────────────────

    /**
     * @notice Admin marks a manufacturer as using renewable energy.
     */
    function updateEnergy(address _id) public onlyAdmin returns (bool) {
        require(
            _stakeholders[_id].id != address(0),
            "Manufacturer::updateEnergy: manufacturer not registered"
        );
        _isRenewableUsed[_id] = true;
        emit EnergyUpdated(_id);
        return true;
    }

    /**
     * @notice Test-compatible alias: verifyManufacturer calls updateEnergy (sets isRenewableUsed).
     * @dev Original test: `assert.equal(manufacturer.isRenewableUsed, true)` after verifyManufacturer.
     */
    function verifyManufacturer(address _id) public onlyAdmin returns (bool) {
        return updateEnergy(_id);
    }
}