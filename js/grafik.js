let monthlyData = {};

async function fetchData() {
    const response = await fetch('https://script.google.com/macros/s/AKfycbxsJaC0dnfMBNOHORhlCoGKcmMCZo52E9oZaKeLZ-xO6fSeIbtDKuePe4emNtQYoE_jKw/exec');
    const data = await response.json();
    prepareMonthlyData(data);
}

function prepareMonthlyData(data) {
    for (let entry of data) {
        const date = new Date(entry['Дата заправки']);
        const month = date.toLocaleString('default', { month: 'long' }); // Извлекаем месяц
        const mileage = parseFloat(entry['Пробег от момента монтажа газа']) || 0;

        if (monthlyData[month]) {
            monthlyData[month] += mileage;
        } else {
            monthlyData[month] = mileage;
        }
    }

    drawChart();
}

function drawChart() {
    const ctx = document.getElementById('mileageChart').getContext('2d');
    const labels = Object.keys(monthlyData);
    const values = Object.values(monthlyData);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Пробег по месяцам',
                data: values,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    enabled: true
                },
                legend: {
                    display: false
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    formatter: (value, context) => {
                        return context.chart.data.labels[context.dataIndex];
                    },
                    color: 'black',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

window.onload = fetchData;
