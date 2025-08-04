export const isGoodPassword = value => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
//al menos un minuscula, un mayuscula, un numero y un caracter especial, al menos 8 caracteres
 regex.test(value);
    return regex.test(value);
} 