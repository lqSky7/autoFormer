/**
 * Extracts form data from Google Form HTML
 */
async function getFormData(url) {
    try {
        const resp = await fetch(url);
        const html = await resp.text();
        
        const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = ([\s\S]*?);\s*<\/script>/);
        
        if (!match || !match[1]) {
            throw new Error('Form data not found in page');
        }
        
        try {
            return JSON.parse(match[1].trim());
        } catch (err) {
            console.error('Parse error:', err);
            throw new Error('Invalid form data: ' + err.message);
        }
    } catch (err) {
        console.error('Form fetch failed:', err);
        throw err;
    }
}

/**
 * Get form submission URL
 */
function getFormResponseUrl(url) {
    let formId;
    
    let match = url.match(/\/forms\/d\/e\/([^\/]+)\/viewform/);
    if (match && match[1]) formId = match[1];
    
    if (!formId) {
        match = url.match(/\/forms\/d\/([^\/]+)\/(viewform|formResponse)/);
        if (match && match[1]) formId = match[1];
    }
    
    if (!formId && !url.includes('/')) formId = url;
    
    if (formId) {
        if (formId.startsWith('1FAIpQL')) {
            return `https://docs.google.com/forms/d/e/${formId}/formResponse`;
        } else {
            return `https://docs.google.com/forms/d/${formId}/formResponse`;
        }
    }
    
    return url.replace('/viewform', '/formResponse').replace('/formResponse/formResponse', '/formResponse');
}

/**
 * Extract form fields and generate submission request
 */
async function getFormSubmitRequest(url, onlyRequired = false, fillAlgorithm, output = "return", withComment = false) {
    try {
        const formData = await getFormData(url);
        
        const formId = formData[14] || formData[1][7];
        const fields = formData[1][1];
        
        const entries = {};
        
        fields.forEach(field => {
            if (!field) return;
            
            const entryId = field[4][0][0];
            const typeId = field[3];
            const required = field[4][0][2] === 1;
            const question = field[1];
            
            if (onlyRequired && !required) return;
            
            let options = [];
            if ([2, 3, 4, 5, 7].includes(typeId) && field[4][0][1]) {
                options = field[4][0][1].map(opt => opt[0]);
            }
            
            const val = fillAlgorithm(typeId, entryId, options, required, question);
            
            if (val !== '') {
                if (Array.isArray(val)) {
                    val.forEach(v => {
                        const key = `entry.${entryId}`;
                        if (!entries[key]) entries[key] = [v];
                        else entries[key].push(v);
                    });
                } else {
                    entries[`entry.${entryId}`] = val;
                }
            }
        });
        
        if (formId) {
            if (String(formId).startsWith('1FAIpQL')) {
                entries['fbzx'] = formId;
            } else {
                const fbId = formData[19] || formData[14];
                entries['fbzx'] = fbId || formId;
            }
        }
        
        entries['fvv'] = 1;
        entries['draftResponse'] = '[]';
        entries['pageHistory'] = 0;
        
        return JSON.stringify(entries);
    } catch (err) {
        console.error('Request generation failed:', err);
        throw err;
    }
}

/**
 * Fill random value for a form entry 
 * Customize your own fill_algorithm here
 */
function fillRandomValue(typeId, entryId, options, required = false, question = '') {
    if (entryId === 'emailAddress') return 'your_email@gmail.com';
    if (question === "Short answer") return 'Random answer!';
    
    if (typeId === 0 || typeId === 1) return !required ? '' : 'Ok!';
    
    if (typeId === 2 || typeId === 3 || typeId === 5 || typeId === 7) {
        return options[Math.floor(Math.random() * options.length)];
    }
    
    if (typeId === 4) {
        const n = Math.floor(Math.random() * options.length) + 1;
        const shuffled = [...options].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }
    
    if (typeId === 9) {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    if (typeId === 10) {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    
    return '';
}

/**
 * Generate random request body data
 */
async function generateRequestBody(url, onlyRequired = false) {
    const data = await getFormSubmitRequest(url, onlyRequired, fillRandomValue, "return", false);
    return JSON.parse(data);
}

/**
 * Submit form to url with data
 */
async function submit(url, data) {
    const formUrl = getFormResponseUrl(url);
    console.log("Submitting to", formUrl);
    console.log("Data:", data);
    
    const params = new URLSearchParams();
    
    Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => { if (v) params.append(key, v); });
        } else {
            if (value) params.append(key, value);
        }
    });
    
    try {
        const dataString = params.toString();
        
        const resp = await fetch(formUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Origin': 'https://docs.google.com',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            },
            body: dataString,
            mode: 'no-cors'
        });
        
        console.log("Form submission sent!");
        return true;
    } catch (err) {
        console.log("Submit error:", err.message);
        return false;
    }
}

/**
 * Main function to fill and submit a Google Form
 * @param {string} url - The Google Form URL
 * @param {boolean} onlyRequired - Whether to fill only required fields
 * @param {number} times - Number of times to submit the form
 * @returns {Object} - Results of the submissions
 */
async function fillForm(url, onlyRequired = false, times = 1) {
    try {
        console.log(`Processing form: ${url} (${times} submissions)`);
        
        let successful = 0;
        let failed = 0;
        
        for (let i = 0; i < times; i++) {
            console.log(`Submission ${i+1}/${times}`);
            const payload = await generateRequestBody(url, onlyRequired);
            console.log("Form data ready");
            
            const result = await submit(url, payload);
            if (result) {
                successful++;
                console.log(`Submission ${i+1}: Success!`);
            } else {
                failed++;
                console.log(`Submission ${i+1}: Failed!`);
            }
            
            // Add a small delay between submissions if multiple
            if (times > 1 && i < times - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`Completed ${times} submissions. Success: ${successful}, Failed: ${failed}`);
        return {
            total: times,
            successful,
            failed
        };
    } catch (err) {
        console.error("Form fill error:", err);
        return false;
    }
}

// Expose the API to the browser
window.GoogleFormAutofill = {
    fillForm,
    generateRequestBody,
    submit,
    fillRandomValue,
    getFormData
};

// Example usage in browser console:
// GoogleFormAutofill.fillForm('https://docs.google.com/forms/d/e/your-form-id/viewform', false);
