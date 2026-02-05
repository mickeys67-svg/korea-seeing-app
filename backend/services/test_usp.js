const USPModel = require('./USPModel');

const testData = {
    layers: [
        { tke: 0.8, windShear: 0.05, ri: 0.5, weight: 0.1 }, // Stable
        { tke: 1.2, windShear: 0.1, ri: -0.1, weight: 0.2 }, // Unstable
        { tke: 0.5, windShear: 0.3, ri: 0.1, weight: 0.7 }   // High Jet
    ],
    surfaceWind: 2.5,
    jetStreamSpeed: 120, // Strong Jet
    targetAltitude: 60,  // 30 deg from zenith
    urban: true,
    elevation: 100,
    aod: 0.2,
    pm25: 15
};

const result = USPModel.calculate(testData);
console.log('--- USP Model Test Result ---');
console.log(JSON.stringify(result, null, 2));

if (result.seeing > 0 && result.score >= 0 && result.score <= 10) {
    console.log('✅ USP Model logic passed basic validation.');
} else {
    console.log('❌ USP Model logic failed validation.');
}
