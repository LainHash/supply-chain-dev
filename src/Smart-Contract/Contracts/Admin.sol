// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Admin
 * @dev Provides a simple single-admin ownership model with an onlyAdmin modifier.
 *      The deploying account becomes the permanent admin.
 */
contract Admin {
    address public admin;

    event AdminSet(address indexed admin);

    constructor(address _admin) {
        require(_admin != address(0), "Admin: admin cannot be zero address");
        admin = _admin;
        emit AdminSet(_admin);
    }

    /// @notice Returns true if the given account is the admin.
    function isAdmin(address _account) public view returns (bool) {
        return _account == admin;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin: caller is not the admin");
        _;
    }
}