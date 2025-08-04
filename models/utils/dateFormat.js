export function formatDate(date) {
    const day= String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2,'0')
    return `${day}-${month}-${year} ${hours}:${minutes}`    
    
}
export function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return new Date(); // Devuelve la fecha actual si la cadena está vacía o no es válida
    }
    const parts = dateString.split(' '); // Divide la fecha y la hora
    if (parts.length !== 2) {
        throw new Error('El formato de fecha no es válido');
    }
    const dateParts = parts[0].split('-'); // Divide la fecha en día, mes y año
    const timeParts = parts[1].split(':'); // Divide la hora en horas y minutos
    // Verifica que se haya dividido correctamente
    if (dateParts.length !== 3 || timeParts.length !== 2) {
        throw new Error('El formato de fecha no es válido');
    }
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Los meses son 0-indexados en JavaScript
    const year = parseInt(dateParts[2], 10);
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    // Crea y devuelve un nuevo objeto Date
    return new Date(year, month, day, hours, minutes);
}