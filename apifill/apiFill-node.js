const argparse = require('argparse');
const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring');

/**
 * Extracts form data from Google Form HTML
 */
async function getFormData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // Extract form identifier from the page
        const formScript = $('script').filter(function() {
            return $(this).html().includes('var FB_PUBLIC_LOAD_DATA_');
        }).html();
        
        if (!formScript) {
            throw new Error('Could not find form data in the page');
        }
        
        // Parse the form data from the script
        const fbDataMatch = formScript.match(/var FB_PUBLIC_LOAD_DATA_ = (.*);/);
        if (!fbDataMatch || !fbDataMatch[1]) {
            throw new Error('Could not extract form data');
        }
        
        const formData = JSON.parse(fbDataMatch[1]);
        return formData;
    } catch (error) {
        console.error('Error fetching form:', error);
        throw error;
    }
}

/**
 * Get form submission URL
 */
function getFormResponseUrl(url) {
    // Extract form ID from URL with various patterns
    let formId;
    
    // Pattern 1: /forms/d/e/[FORM_ID]/viewform
    let match = url.match(/\/forms\/d\/e\/([^\/]+)\/viewform/);
    if (match && match[1]) {
        formId = match[1];
    }
    
    // Pattern 2: /forms/d/[FORM_ID]/viewform or /forms/d/[FORM_ID]/formResponse
    if (!formId) {
        match = url.match(/\/forms\/d\/([^\/]+)\/(viewform|formResponse)/);
        if (match && match[1]) {
            formId = match[1];
        }
    }
    
    // Pattern 3: Just the form ID
    if (!formId && !url.includes('/')) {
        formId = url;
    }
    
    // Construct the proper submission URL
    if (formId) {
        // Check if form ID is already in the e/[FORM_ID] format
        if (formId.startsWith('1FAIpQL')) {
            return `https://docs.google.com/forms/d/e/${formId}/formResponse`;
        } else {
            // For direct form IDs, use the direct format
            return `https://docs.google.com/forms/d/${formId}/formResponse`;
        }
    }
    
    // Fallback to simple replacement
    return url.replace('/viewform', '/formResponse').replace('/formResponse/formResponse', '/formResponse');
}

/**
 * Extract form fields and generate submission request
 */
async function getFormSubmitRequest(url, onlyRequired = false, fillAlgorithm, output = "return", withComment = false) {
    try {
        const formData = await getFormData(url);
        
        // Extract form ID and form fields
        const formId = formData[14] || formData[1][7]; // Forms typically store ID here
        const formFields = formData[1][1]; // Form fields are typically in this location
        
        const formEntries = {};
        
        // Process each form field
        formFields.forEach(field => {
            if (!field) return;
            
            const entryId = field[4][0][0]; // Entry ID
            const typeId = field[3]; // Type of form field
            const required = field[4][0][2] === 1; // Required flag
            const entryName = field[1]; // Question/Entry name
            
            // Skip non-required fields if onlyRequired is true
            if (onlyRequired && !required) return;
            
            let options = [];
            // Extract options based on field type
            if ([2, 3, 4, 5, 7].includes(typeId) && field[4][0][1]) {
                options = field[4][0][1].map(opt => opt[0]); // Extract option texts
            }
            
            // Use the provided fill algorithm to generate a value
            const value = fillAlgorithm(typeId, entryId, options, required, entryName);
            
            if (value !== '') {
                if (Array.isArray(value)) {
                    // Handle multiple selections (checkboxes)
                    value.forEach(v => {
                        const key = `entry.${entryId}`;
                        if (!formEntries[key]) {
                            formEntries[key] = [v];
                        } else {
                            formEntries[key].push(v);
                        }
                    });
                } else {
                    // Single value fields
                    formEntries[`entry.${entryId}`] = value;
                }
            }
        });
        
        // Add form identifier
        if (formId) {
            // If the form ID is already the proper format (1FAIpQL...), use it
            if (String(formId).startsWith('1FAIpQL')) {
                formEntries['fbzx'] = formId;
            } else {
                // Try to extract the proper form ID from FB_PUBLIC_LOAD_DATA_
                const fbzxFromData = formData[19] || formData[14];
                if (fbzxFromData) {
                    formEntries['fbzx'] = fbzxFromData;
                } else {
                    formEntries['fbzx'] = formId;
                }
            }
        }
        
        // Add required metadata for form submission
        formEntries['fvv'] = 1;
        formEntries['draftResponse'] = '[]';
        formEntries['pageHistory'] = 0;
        
        return JSON.stringify(formEntries);
    } catch (error) {
        console.error('Error generating form request:', error);
        throw error;
    }
}

/**
 * Fill random value for a form entry 
 * Customize your own fill_algorithm here
 * Note: please follow this func signature to use as fill_algorithm in form.get_form_submit_request
 */
function fillRandomValue(typeId, entryId, options, required = false, entryName = '') {
    // Customize for specific entry_id
    if (entryId === 'emailAddress') {
        return 'your_email@gmail.com';
    }
    if (entryName === "Short answer") {
        return 'Random answer!';
    }
    // Random value for each type
    if (typeId === 0 || typeId === 1) { // Short answer and Paragraph
        return !required ? '' : 'Ok!';
    }
    if (typeId === 2) { // Multiple choice
        return options[Math.floor(Math.random() * options.length)];
    }
    if (typeId === 3) { // Dropdown
        return options[Math.floor(Math.random() * options.length)];
    }
    if (typeId === 4) { // Checkboxes
        const numToSelect = Math.floor(Math.random() * options.length) + 1;
        const shuffled = [...options].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, numToSelect);
    }
    if (typeId === 5) { // Linear scale
        return options[Math.floor(Math.random() * options.length)];
    }
    if (typeId === 7) { // Grid choice
        return options[Math.floor(Math.random() * options.length)];
    }
    if (typeId === 9) { // Date
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    if (typeId === 10) { // Time
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return '';
}

/**
 * Generate random request body data
 */
async function generateRequestBody(url, onlyRequired = false) {
    const data = await getFormSubmitRequest(
        url,
        onlyRequired,
        fillRandomValue,
        "return",
        false
    );
    return JSON.parse(data);
}

/**
 * Submit form to url with data
 */
async function submit(url, data) {
    const formResponseUrl = getFormResponseUrl(url);
    console.log("Submitting to", formResponseUrl);
    console.log("Data:", data);
    
    // Handle array values properly by creating URLSearchParams with the same key repeated
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
            // For checkbox/multiple-select, add each value with the same key
            value.forEach(v => {
                if (v) params.append(key, v);
            });
        } else {
            // For single values
            if (value) params.append(key, value);
        }
    }
    
    try {
        // Convert URLSearchParams to string
        const formDataString = params.toString();
        
        const res = await axios.post(formResponseUrl, formDataString, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Origin': 'https://docs.google.com',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            },
            timeout: 8000, // Increased timeout for better reliability
            validateStatus: status => status < 400 // Consider any status below 400 as success
        });
        
        if (res.status >= 200 && res.status < 300) {
            console.log("Form submitted successfully! Status:", res.status);
        } else {
            console.log("Warning: Unexpected response status:", res.status);
        }
    } catch (error) {
        console.log("Error during submission:", error.message);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log("Response data:", error.response.data);
            console.log("Response status:", error.response.status);
            console.log("Response headers:", error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.log("No response received from server");
        } else {
            // Something happened in setting up the request that triggered an Error
            console.log("Error configuring request:", error.config);
        }
    }
}

async function main(url, onlyRequired = false) {
    try {
        const payload = await generateRequestBody(url, onlyRequired);
        await submit(url, payload);
        console.log("Done!!!");
    } catch (e) {
        console.log("Error!", e);
    }
}

if (require.main === module) {
    const parser = new argparse.ArgumentParser({
        description: 'Submit google form with custom data'
    });
    parser.add_argument('url', { help: 'Google Form URL' });
    parser.add_argument('-r', '--required', {
        action: 'store_true',
        help: 'Only include required fields'
    });
    
    const args = parser.parse_args();
    main(args.url, args.required);
}
