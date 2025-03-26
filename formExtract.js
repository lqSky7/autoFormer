// Constants
const FORM_SESSION_TYPE_ID = 8;
const ANY_TEXT_FIELD = "ANY TEXT!!";

function parseFormEntries(onlyRequired = false) {
  // The FB_PUBLIC_LOAD_DATA_ variable is already available in the page context
  const v = window.FB_PUBLIC_LOAD_DATA_;
  
  if (!v || !v[1] || !v[1][1]) {
    console.error("Error! Can't get form entries. Login may be required.");
    return null;
  }
  
  function parseEntry(entry) {
    const entryName = entry[1];
    const entryTypeId = entry[3];
    let result = [];
    
    for (const subEntry of entry[4]) {
      const info = {
        id: subEntry[0],
        container_name: entryName,
        type: entryTypeId,
        required: subEntry[2] === 1,
        name: (subEntry.length > 3 && subEntry[3]) ? subEntry[3].join(' - ') : null,
        options: subEntry[1] ? subEntry[1].map(x => x[0] || ANY_TEXT_FIELD) : null,
      };
      
      if (onlyRequired && !info.required) {
        continue;
      }
      
      result.push(info);
    }
    
    return result;
  }
  
  let parsedEntries = [];
  let pageCount = 0;
  
  for (const entry of v[1][1]) {
    if (entry[3] === FORM_SESSION_TYPE_ID) {
      pageCount += 1;
      continue;
    }
    parsedEntries = parsedEntries.concat(parseEntry(entry));
  }
  
  // Collect email addresses
  if (v[1][10] && v[1][10][6] > 1) {
    parsedEntries.push({
      id: "emailAddress",
      container_name: "Email Address",
      type: "required",
      required: true,
      options: "email address",
    });
  }
  
  if (pageCount > 0) {
    parsedEntries.push({
      id: "pageHistory",
      container_name: "Page History",
      type: "required",
      required: false,
      options: "from 0 to (number of page - 1)",
      default_value: Array.from({ length: pageCount + 1 }, (_, i) => i).join(',')
    });
  }
  
  return parsedEntries;
}

// Format entries in the requested structure with comments
function formatForAutoFill(entries) {
  let result = '{\n';
  
  for (const entry of entries) {
    // Add the question as a comment
    result += `    # ${entry.container_name}\n`;
    
    // Add options as a comment if available
    if (entry.options) {
      if (Array.isArray(entry.options)) {
        result += `    #   Options: ${JSON.stringify(entry.options)}\n`;
      } else {
        result += `    #   Options: ${entry.options}\n`;
      }
    }
    
    // Add the entry key with empty value
    result += `    "entry.${entry.id}": "",\n`;
  }
  
  // Remove the trailing comma and close the object
  result = result.slice(0, -2) + '\n}';
  
  return result;
}

// Get the form response URL
function getFormResponseUrl() {
  let url = window.location.href;
  url = url.replace('/viewform', '/formResponse');
  if (!url.endsWith('/formResponse')) {
    if (!url.endsWith('/')) {
      url += '/';
    }
    url += 'formResponse';
  }
  return url;
}

// Run the functions and display the results
const formEntries = parseFormEntries();
console.log("Form response URL:", getFormResponseUrl());
console.log("\nForm entries in autofill format:");
console.log(formatForAutoFill(formEntries));

// You can also choose to only display required fields
// const requiredEntries = parseFormEntries(true);
console.log("\nRequired entries in autofill format:");
console.log(formatForAutoFill(requiredEntries));