exports.handler = async function(event, context) {
  // CORS & method check
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "GITHUB_TOKEN environment variable is not configured in Netlify." })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const businesses = body.businesses;
    if (!Array.isArray(businesses)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid data: 'businesses' array is required." })
      };
    }

    const owner = process.env.GITHUB_OWNER || "harsh20wardhan";
    const repo = process.env.GITHUB_REPO || "sonarsamajindore";
    const path = "content/business_directory.json";

    // 1. Fetch current file SHA
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Netlify-Save-Business"
      }
    });

    let sha = null;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }

    const payload = {
      title: "सोनार समाज इंदूर - व्यावसायिक निर्देशिका (Business Directory)",
      description: "इंदूर व परिसरातील सोनार समाज बांधवांच्या प्रतिष्ठानांची, दुकानांची व सेवांची अधिकृत यादी",
      last_updated: new Date().toISOString(),
      businesses: businesses
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const base64 = Buffer.from(jsonStr, "utf8").toString("base64");

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Netlify-Save-Business"
      },
      body: JSON.stringify({
        message: "update: business directory updated via admin panel",
        content: base64,
        sha: sha,
        branch: "main"
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message || "GitHub commit failed" })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ success: true, message: "Successfully committed to GitHub repository!" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
