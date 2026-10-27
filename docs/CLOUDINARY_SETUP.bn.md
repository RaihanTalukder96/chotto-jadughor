# Cloudinary setup — প্রথম ধাপ

Credentials শুধু `apps/api/.env`-এ রাখুন। `.env` Git-ignored; `.env.example`-এ শুধু খালি placeholder থাকবে। Secret চ্যাটে, screenshot-এ, frontend-এ বা `VITE_` variable-এ দেবেন না।

1. https://console.cloudinary.com/ খুলে নিজের account-এ sign in করুন। নতুন account হলে Free plan ব্যবহার করুন; paid upgrade এই ধাপে প্রয়োজন নেই।
2. সঠিক Product Environment নির্বাচন করুন। Dashboard থেকে Cloud Name নিন।
3. Settings → API Keys খুলুন। একই environment-এর API Key ও API Secret নিজের local editor-এ কপি করুন। আলাদা key বানালে চেনার জন্য `chotto-jadughor-local` নাম ব্যবহার করতে পারেন।
4. `apps/api/.env`-এর এই তিনটি মান পূরণ করুন:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

পুরো `CLOUDINARY_URL` এখানে বসাবেন না; অ্যাপ তিনটি আলাদা variable পড়ে। Upload preset বা unsigned uploads চালু করার প্রয়োজন নেই। Backend নিজের secret দিয়ে signed server upload করে।

5. ফাইল Save করুন। Assistant-কে শুধু configuration সম্পন্ন হওয়ার কথা জানান; কোনো value পাঠাবেন না। API restart করার পর নতুন environment লোড হবে।

## এরপর যাচাই

- প্রথমে value না দেখিয়ে তিনটি variable উপস্থিত কি না যাচাই করা হবে।
- Local development PostgreSQL/API/frontend চালিয়ে authenticated application দিয়ে নির্দিষ্ট test product-এ একটি প্রকৃত JPEG/PNG/WebP upload করা হবে।
- Product details ও Dashboard thumbnail-এ delivery এবং reload-এর পরে persistence যাচাই করা হবে।
- দ্বিতীয় ভিন্ন image দিয়ে replacement; নতুন image/public ID-এর reference এবং পুরোনো asset-এর cleanup queue যাচাই করা হবে।
- Cleanup worker ১৫ মিনিট অন্তর চলে; queue-তে অন্তত ১০ মিনিট থাকা asset-ই delete করে। তাই replacement-এর সঙ্গে সঙ্গে পুরোনো Cloudinary asset মুছে গেছে বলে দাবি করা হবে না। Worker চলার পরে deletion ও নতুন referenced asset অক্ষত থাকা নিশ্চিত করা হবে।
- Credentials বা sensitive provider response log/চ্যাটে প্রকাশ করা হবে না। Free quota-র মধ্যে অল্প test asset ব্যবহার করা হবে; paid upgrade বা paid resource তৈরি করার আগে খরচসহ অনুমতি নিতে হবে।

Cloudinary শেষ হলে ক্রমানুসারে managed PostgreSQL → Render API → Vercel frontend করা হবে। Production-এ demo seed ব্যবহার হবে না। শক্তিশালী environment-provided credentials দিয়ে deliberate admin bootstrap হবে। Custom domain না থাকলে Vercel-এর same-origin `/api` proxy ব্যবহার হবে; live domains পাওয়া গেলে exact Origin/CORS/CSRF ও secure session cookies পরীক্ষা করা হবে।

বর্তমান অবস্থা (২৭ অক্টোবর ২০২৬): configured credentials দিয়ে live server-signed upload, Dashboard thumbnail display, reload-এর পরে display, দ্বিতীয় image দিয়ে replacement এবং পুরোনো asset deletion সফলভাবে যাচাই হয়েছে। নতুন referenced image cleanup-এর সময় অক্ষত ছিল। শুধু পৃথক local QA database ও এই পরীক্ষায় তৈরি asset ব্যবহার করা হয়েছে। পরীক্ষার শেষে test assets, product, category এবং temporary user সরানো হয়েছে।

Cleanup পরীক্ষায় শুধু test asset-এর queue timestamp ১১ মিনিট পুরোনো করে production cleanup function চালানো হয়েছে; স্বাভাবিক ১৫-মিনিট timer-এর জন্য অপেক্ষা করা হয়নি। Cloudinary-এর nested 404 response পরীক্ষার script-এ handle করার পরে deletion check সফল হয়; application code বদলাতে হয়নি। কোনো credential output বা commit করা হয়নি। পরীক্ষার ফল `.local/qa/cloudinary-live-results.json` এবং screenshots একই ignored directory-তে আছে।

Official reference: https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials
