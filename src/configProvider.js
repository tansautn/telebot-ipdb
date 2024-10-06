/*
 *          M""""""""`M            dP
 *          Mmmmmm   .M            88
 *          MMMMP  .MMM  dP    dP  88  .dP   .d8888b.
 *          MMP  .MMMMM  88    88  88888"    88'  `88
 *          M' .MMMMMMM  88.  .88  88  `8b.  88.  .88
 *          M         M  `88888P'  dP   `YP  `88888P'
 *          MMMMMMMMMMM    -*-  Created by Zuko  -*-
 *
 *          * * * * * * * * * * * * * * * * * * * * *
 *          * -    - -   F.R.E.E.M.I.N.D   - -    - *
 *          * -  Copyright © 2024 (Z) Programing  - *
 *          *    -  -  All Rights Reserved  -  -    *
 *          * * * * * * * * * * * * * * * * * * * * *
 */

const configs = {
    'labels': {
        'askForCustomAcc': 'Vui lòng nhập acc tùy chỉnh cho IP',
    }
};

export function getConfig(key) {
    // Convert the key to SCREAM_CASE
    const globalVarName = key.toUpperCase().replace(/\./g, '__');

    // Check if there's a corresponding global variable
    if (typeof global !== 'undefined' && global[globalVarName] !== undefined) {
        return global[globalVarName];
    }

    // If no global variable, get the value from configs
    const parts = key.split('.');
    let current = configs;

    for (const part of parts) {
        if (current && current.hasOwnProperty(part)) {
            current = current[part];
        } else {
            return undefined; // Key not found in configs
        }
    }

    return current;
}
