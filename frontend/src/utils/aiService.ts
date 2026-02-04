export interface WeatherInput {
    seeing: number; // 1-8 (1 is best)
    transparency: number; // 1-8
    cloudCover: number; // 1-9
    windSpeed: number; // m/s
    humidity: number; // %
}

export const predictSeeing = (input: WeatherInput) => {
    // Defines a mock AI Scoring System
    // Lower score is better for seeing, but we want to return a "Success Probability" %

    // Factors (Weights)
    // Seeing: 40%
    // Cloud: 30%
    // Transparency: 20%
    // Wind: 10%

    // Normalize inputs to 0-1 scale (0 being best condition)
    const normSeeing = (input.seeing - 1) / 7; // 1->0, 8->1
    const normCloud = (input.cloudCover - 1) / 8; // 1->0, 9->1
    const normTrans = (input.transparency - 1) / 7;

    // Wind: assume > 10m/s is bad.
    const normWind = Math.min(input.windSpeed / 10, 1);

    const score = (normSeeing * 0.4) + (normCloud * 0.3) + (normTrans * 0.2) + (normWind * 0.1);

    // Convert bad score (0-1) to Success Probability (100-0)
    const probability = Math.round((1 - score) * 100);

    let comment = "";
    if (probability >= 90) comment = "Steady skies! Excellent conditions, perfect for planetary imaging.";
    else if (probability >= 70) comment = "Stable air. Good conditions; Deep sky objects should be clear.";
    else if (probability >= 50) comment = "Average. Some turbulence expected, not perfectly steady skies.";
    else if (probability >= 30) comment = "Poor. Stable air is missing due to high clouds or turbulence.";
    else comment = "Unstable atmosphere. Not recommended for observation today.";

    return { probability, comment };
};
