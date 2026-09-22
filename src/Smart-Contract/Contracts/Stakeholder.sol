// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Admin.sol";

/**
 * @title Stakeholder
 * @dev Base contract for all supply-chain participants (farmers, manufacturers,
 *      distributors, retailers, consumers).  Extends Admin so that the first
 *      deploying account is always the administrator.
 *
 * Key design decisions preserved from original:
 *  - The `stakeholder` struct is the canonical identity record.
 *  - `_stakeholders` mapping keyed by address.
 *  - `_stakeholderAddresses` array for enumeration (used by the admin verify UI).
 *  - Product ownership & operator approvals live here so they are shared.
 *
 * What was added / fixed:
 *  - Error messages on every require().
 *  - Events: StakeholderRegistered, StakeholderVerified, ApprovalForAll, ProductTransferred.
 *  - `onlyRegisteredStakeholder` modifier (renamed from broken `onlyStakeholder`).
 *  - `getRole()` exposed as external view for Main.sol.
 */
contract Stakeholder is Admin {

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct stakeholder {
        address id;
        string  name;
        string  location;
        string  role;
        bool    isVerified;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    mapping(address => stakeholder)                        _stakeholders;
    mapping(address => mapping(uint256 => bool))           _stakeholderProductOwnership;
    mapping(address => mapping(address => bool))           _operatorApprovals;
    address[]                                              _stakeholderAddresses;

    // ─── Events ────────────────────────────────────────────────────────────────

    event StakeholderRegistered(address indexed id, string name, string role);
    event StakeholderVerified(address indexed id);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event ProductTransferred(address indexed from, address indexed to, uint256 indexed productId);

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() Admin(msg.sender) {}

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * @notice Register the caller as a stakeholder.
     * @dev Virtual so Farmer and Manufacturer can override if they need extra state,
     *      but Stakeholder subclass (distributors, retailers, consumers) uses this directly.
     */
    function register(
        string memory _name,
        string memory _location,
        string memory _role
    ) public virtual returns (bool) {
        require(bytes(_name).length > 0,     "Stakeholder::register: name cannot be empty");
        require(bytes(_location).length > 0, "Stakeholder::register: location cannot be empty");
        require(bytes(_role).length > 0,     "Stakeholder::register: role cannot be empty");
        require(
            _stakeholders[msg.sender].id == address(0),
            "Stakeholder::register: already registered"
        );
        _stakeholders[msg.sender] = stakeholder(msg.sender, _name, _location, _role, false);
        _stakeholderAddresses.push(msg.sender);
        emit StakeholderRegistered(msg.sender, _name, _role);
        return true;
    }

    // ─── Retrieval ─────────────────────────────────────────────────────────────

    /**
     * @notice Return the stakeholder record for `_id`.
     * @dev Access is public: any registered stakeholder can look up any other
     *      stakeholder, and a completely unregistered caller can also call this
     *      (they will receive the zero-valued struct for unknown addresses).
     *      The original `onlyStakeholder` modifier was logically inverted and
     *      prevented legitimate lookups; it has been removed.
     */
    function get(address _id) public view virtual returns (stakeholder memory) {
        return _stakeholders[_id];
    }

    /// @notice Returns the role string for `_id` (empty string if not registered).
    function getRole(address _id) public view returns (string memory) {
        return _stakeholders[_id].role;
    }

    /// @notice Returns true if `_id` is verified.
    function isVerified(address _id) public view returns (bool) {
        return _stakeholders[_id].isVerified;
    }

    /// @notice Returns all registered stakeholder addresses (used by admin UI).
    function getAddresses() public view returns (address[] memory) {
        return _stakeholderAddresses;
    }

    // ─── Admin operations ──────────────────────────────────────────────────────

    /**
     * @notice Admin can verify a stakeholder, enabling trust signals.
     */
    function verify(address _id) public onlyAdmin returns (bool) {
        require(
            _stakeholders[_id].id != address(0),
            "Stakeholder::verify: stakeholder not registered"
        );
        _stakeholders[_id].isVerified = true;
        emit StakeholderVerified(_id);
        return true;
    }

    // ─── Operator approvals ────────────────────────────────────────────────────

    function setApprovalForAll(
        address _operator,
        bool    _approved
    ) public virtual returns (bool) {
        require(msg.sender != _operator, "Stakeholder::setApprovalForAll: cannot approve self");
        require(_operator != address(0), "Stakeholder::setApprovalForAll: operator is zero address");
        _operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
        return true;
    }

    function isApprovedForAll(
        address _owner,
        address _operator
    ) public view virtual returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    // ─── Product ownership transfer ────────────────────────────────────────────

    function transferFrom(
        address  _from,
        address  _to,
        uint256  _productId
    ) public virtual onlyOwnerOrApproved(_from, _productId) returns (bool) {
        require(_from != _to,          "Stakeholder::transferFrom: cannot transfer to self");
        require(_to != address(0),     "Stakeholder::transferFrom: cannot transfer to zero address");
        _stakeholderProductOwnership[_from][_productId] = false;
        _stakeholderProductOwnership[_to][_productId]   = true;
        emit ProductTransferred(_from, _to, _productId);
        return true;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwnerOrApproved(address _from, uint256 _productId) {
        bool isProductOwner = _stakeholderProductOwnership[_from][_productId];
        bool isAuthorised   = isApprovedForAll(_from, msg.sender) || msg.sender == _from;
        require(
            isProductOwner && isAuthorised,
            "Stakeholder: caller is not owner or approved"
        );
        _;
    }

    modifier onlyRegistered() {
        require(
            _stakeholders[msg.sender].id != address(0),
            "Stakeholder: caller is not registered"
        );
        _;
    }
}