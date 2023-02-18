let message = 'A';
let code1 = '011'
let soundControl = [];

ascii_message = message.charCodeAt();
binary_message = ascii_message.toString(2);
reversed_message = binary_message.split("").reverse().join("");
combined_code_message = code1 + reversed_message;
soundControl = combined_code_message.split("");
console.log(soundControl)
